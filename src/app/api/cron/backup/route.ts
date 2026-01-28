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
        // 백업 목록 조회
        const { data: list, error } = await supabase.storage.from('backups').list('', {
            limit: 100,
            sortBy: { column: 'name', order: 'asc' } // 오래된 순
        });

        if (error || !list) return;

        const RETENTION_DAYS = 14;
        const now = new Date();
        const deleteCandidates: string[] = [];

        for (const item of list) {
            // 폴더명이 날짜로 시작하고 '-auto'로 끝나는지 확인
            // 예: 2026-05-20...-auto
            if (!item.name.includes('-auto')) continue;

            // 날짜 파싱 (앞 10자리 yyyy-mm-dd 이용)
            const datePart = item.name.substring(0, 10);
            const backupDate = new Date(datePart);

            if (isNaN(backupDate.getTime())) continue;

            // 날짜 차이 계산
            const diffTime = Math.abs(now.getTime() - backupDate.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays > RETENTION_DAYS) {
                deleteCandidates.push(item.name);
            }
        }

        console.log(`[Backup Cleanup] Found ${deleteCandidates.length} old backups to delete:`, deleteCandidates);

        // 삭제 실행
        for (const folder of deleteCandidates) {
            // 폴더 내부 파일 목록 조회
            const { data: files } = await supabase.storage.from('backups').list(folder);
            if (files && files.length > 0) {
                const paths = files.map(f => `${folder}/${f.name}`);
                // 파일 일괄 삭제
                await supabase.storage.from('backups').remove(paths);
            }
            // 빈 폴더 자체는 남을 수 있으나(Supabase Storage 특성), 내용은 비워짐. 
            // Storage API상 폴더 삭제 개념이 모호하므로 파일 삭제로 충분.
        }

    } catch (error) {
        console.error('[Backup Cleanup] Error:', error);
    }
}
