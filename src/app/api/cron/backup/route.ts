import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// 백업 대상 테이블 목록
const BACKUP_TABLES = [
    'orders', 'customers', 'products', 'materials', 'partners', 'employees',
    'branches', 'budgets', 'recipients',
    'simple_expenses', 'stock_history', 'quotations', 'material_requests',
    'point_history', 'photos',
    'albums', 'checklist_templates', 'checklists', 'workers',
    'order_transfers', 'display_board',
    'supplier_suggestions', 'fixed_cost_templates',
    'purchase_batches', 'expense_requests', 'daily_stats', 'daily_settlements',
    'calendar_events', 'delivery_fees'
];

export const dynamic = 'force-dynamic'; // Static generation 방지

export async function GET(req: NextRequest) {
    // 간단한 인증 헤더 확인 (Vercel Cron에서 호출할 때 사용)
    // 보안을 위해 실제 운영 시에는 CRON_SECRET 환경변수를 설정하고 확인하는 것이 좋습니다.
    const authHeader = req.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        // 로컬 테스트나 개발 환경 편의를 위해 일단 주석 처리하거나 로그만 남길 수 있습니다.
        // return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const now = new Date();
        // 폴더명 형식: 2026-05-20_03-00-00-auto
        const folderName = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-auto`;

        console.log(`[Backup] Starting backup: ${folderName}`);

        let successCount = 0;
        const errors: Record<string, string> = {};

        // 1. 테이블 데이터 백업
        for (const table of BACKUP_TABLES) {
            try {
                const { data, error } = await supabase.from(table).select('*');
                if (error) throw error;

                if (data && data.length > 0) {
                    const fileContent = JSON.stringify(data, null, 2);
                    const { error: uploadError } = await supabase.storage
                        .from('backups')
                        .upload(`${folderName}/${table}.json`, fileContent, {
                            contentType: 'application/json',
                            upsert: true
                        });

                    if (uploadError) throw uploadError;
                    successCount++;
                }
            } catch (err: any) {
                console.error(`[Backup] Failed to backup table ${table}:`, err);
                errors[table] = err.message || JSON.stringify(err);
            }
        }

        // 2. 오래된 백업 정리 (Retention Policy: 14일)
        // 'auto' 태그가 붙은 백업 중 14일이 지난 것 삭제
        await cleanupOldBackups();

        return NextResponse.json({
            success: true,
            folder: folderName,
            backed_up_tables: successCount,
            errors: Object.keys(errors).length > 0 ? errors : undefined,
            timestamp: now.toISOString()
        });

    } catch (error: any) {
        console.error('[Backup] Critical error:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

async function cleanupOldBackups() {
    try {
        const RETENTION_DAYS = 7; // [조정] 14일에서 7일로 변경
        const now = new Date();

        // 1. 새 백업 버킷(backups) 정리
        const { data: list, error: listError } = await supabase.storage.from('backups').list('', {
            limit: 100,
            sortBy: { column: 'name', order: 'asc' }
        });

        if (!listError && list) {
            for (const item of list) {
                if (!item.name.includes('-auto')) continue;
                const datePart = item.name.substring(0, 10);
                const backupDate = new Date(datePart);
                if (isNaN(backupDate.getTime())) continue;

                const diffDays = Math.ceil(Math.abs(now.getTime() - backupDate.getTime()) / (1000 * 60 * 60 * 24));

                if (diffDays > RETENTION_DAYS) {
                    console.log(`[Backup Cleanup] Deleting from 'backups': ${item.name}`);
                    const { data: files } = await supabase.storage.from('backups').list(item.name);
                    if (files && files.length > 0) {
                        await supabase.storage.from('backups').remove(files.map(f => `${item.name}/${f.name}`));
                    }
                }
            }
        }

        // 2. 구형 백업 폴더(general/backups) 정리 - 앞으로 쌓이지 않게 감시 대상에 포함
        const { data: genList, error: genError } = await supabase.storage.from('general').list('backups', { limit: 100 });
        if (!genError && genList) {
            for (const item of genList) {
                // 폴더명에서 날짜 추출 (ISO 형식 또는 yyyy-mm-dd)
                const datePart = item.name.substring(0, 10);
                const backupDate = new Date(datePart);
                if (isNaN(backupDate.getTime())) continue;

                const diffDays = Math.ceil(Math.abs(now.getTime() - backupDate.getTime()) / (1000 * 60 * 60 * 24));

                if (diffDays > RETENTION_DAYS) {
                    console.log(`[Backup Cleanup] Deleting legacy from 'general/backups': ${item.name}`);
                    const { data: files } = await supabase.storage.from('general').list(`backups/${item.name}`);
                    if (files && files.length > 0) {
                        await supabase.storage.from('general').remove(files.map(f => `backups/${item.name}/${f.name}`));
                    }
                }
            }
        }

    } catch (error) {
        console.error('[Backup Cleanup] Error:', error);
    }
}
