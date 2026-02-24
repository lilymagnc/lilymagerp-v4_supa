import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data, error } = await supabase
        .from('daily_settlements')
        .select('*')
        .order('date', { ascending: false })
        .limit(10);

    if (error) {
        console.error(error);
    } else {
        for (const d of data) {
            console.log(`${d.date} | ${d.branch_name} | Prev: ${d.settlement_data.previousVaultBalance} | Sales: ${d.settlement_data.cashSalesToday} | Deposit: ${d.settlement_data.vaultDeposit} | Transport: ${d.settlement_data.deliveryCostCashToday} | Other: ${d.settlement_data.cashExpenseToday}`);
        }
    }
}
check();
