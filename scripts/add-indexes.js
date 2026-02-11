const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function addIndexes() {
    console.log('🔧 Supabase JSONB 인덱스 생성 시작...\n');

    // 1. 먼저 exec_sql 함수 생성
    const createFuncSQL = `
    CREATE OR REPLACE FUNCTION exec_sql(sql text)
    RETURNS void
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    BEGIN
      EXECUTE sql;
    END;
    $$;
  `;

    // service_role로 직접 rest api 호출하여 SQL 실행
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ sql: 'SELECT 1' })
    });

    if (response.status === 404) {
        console.log('⚠️ exec_sql 함수가 없습니다.');
        console.log('');
        console.log('=== Supabase Dashboard → SQL Editor에서 아래 SQL을 실행해 주세요 ===');
        console.log('');
        console.log('-- 1. exec_sql 헬퍼 함수 생성');
        console.log(createFuncSQL);
        console.log('');
        console.log('-- 2. 인덱스 생성');

        const indexSQLs = [
            `CREATE INDEX IF NOT EXISTS idx_orders_payment_completed_at ON orders ((payment->>'completedAt'));`,
            `CREATE INDEX IF NOT EXISTS idx_orders_transfer_accepted_at ON orders ((transfer_info->>'acceptedAt'));`,
            `CREATE INDEX IF NOT EXISTS idx_orders_transfer_process_branch ON orders ((transfer_info->>'processBranchName'));`,
            `CREATE INDEX IF NOT EXISTS idx_orders_branch_name ON orders (branch_name);`,
            `CREATE INDEX IF NOT EXISTS idx_orders_order_date ON orders (order_date DESC);`,
            `CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);`,
            `CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders ((payment->>'status'));`,
            `CREATE INDEX IF NOT EXISTS idx_orders_orderer_contact ON orders ((orderer->>'contact'));`,
            `CREATE INDEX IF NOT EXISTS idx_orders_orderer_id ON orders ((orderer->>'id'));`,
        ];

        indexSQLs.forEach(sql => console.log(sql));
        console.log('');
        console.log('=== 위 SQL을 복사하여 한번에 실행하시면 됩니다 ===');
        return;
    }

    // exec_sql이 존재하면 인덱스 생성
    const indexes = [
        { sql: `CREATE INDEX IF NOT EXISTS idx_orders_payment_completed_at ON orders ((payment->>'completedAt'))`, desc: 'payment.completedAt' },
        { sql: `CREATE INDEX IF NOT EXISTS idx_orders_transfer_accepted_at ON orders ((transfer_info->>'acceptedAt'))`, desc: 'transfer_info.acceptedAt' },
        { sql: `CREATE INDEX IF NOT EXISTS idx_orders_transfer_process_branch ON orders ((transfer_info->>'processBranchName'))`, desc: 'transfer_info.processBranchName' },
        { sql: `CREATE INDEX IF NOT EXISTS idx_orders_branch_name ON orders (branch_name)`, desc: 'branch_name' },
        { sql: `CREATE INDEX IF NOT EXISTS idx_orders_order_date ON orders (order_date DESC)`, desc: 'order_date' },
        { sql: `CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status)`, desc: 'status' },
        { sql: `CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders ((payment->>'status'))`, desc: 'payment.status' },
        { sql: `CREATE INDEX IF NOT EXISTS idx_orders_orderer_contact ON orders ((orderer->>'contact'))`, desc: 'orderer.contact' },
        { sql: `CREATE INDEX IF NOT EXISTS idx_orders_orderer_id ON orders ((orderer->>'id'))`, desc: 'orderer.id' },
    ];

    let success = 0;
    for (const idx of indexes) {
        const { error } = await supabase.rpc('exec_sql', { sql: idx.sql });
        if (error) {
            console.error(`❌ ${idx.desc}: ${error.message}`);
        } else {
            console.log(`✅ ${idx.desc} 인덱스 생성 완료`);
            success++;
        }
    }

    console.log(`\n🎉 ${success}/${indexes.length}개 인덱스 생성 완료!`);
}

addIndexes();
