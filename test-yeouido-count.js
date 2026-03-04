require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
    const { data: orders, error } = await supabase.from('orders').select('*')
        .filter('order_date', 'gte', '2026-03-02T00:00:00')
        .filter('order_date', 'lt', '2026-03-04T00:00:00');

    if (error) {
        console.error(error);
        return;
    }

    const todayOrders = orders.filter(o => o.status !== 'canceled');
    const yeouidoOrders = todayOrders.filter(o => {
        // Convert UTC to KST and check if it's 2026-03-03
        const kstDate = new Date(new Date(o.order_date).getTime() + 9 * 60 * 60 * 1000);
        const dateStr = kstDate.toISOString().split('T')[0];
        if (dateStr !== '2026-03-03') return false;

        const isOrig = o.branch_name === '여의도점';
        const isTrans = o.transfer_info?.isTransferred &&
            (o.transfer_info?.status === 'accepted' || o.transfer_info?.status === 'completed') &&
            o.transfer_info?.processBranchName === '여의도점';
        return isOrig || isTrans;
    });

    console.log('Yeouido received on March 3:', yeouidoOrders.length);
    const details = yeouidoOrders.map(o => ({
        id: o.id,
        category: o.category,
        total: o.summary.total,
        paymentStatus: o.payment?.status,
        branch: o.branch_name,
        transferInfo: o.transfer_info?.processBranchName ? {
            processBranchName: o.transfer_info.processBranchName,
            status: o.transfer_info.status
        } : null,
        payDates: {
            completedAt: o.payment?.completedAt ? new Date(new Date(o.payment.completedAt).getTime() + 9 * 60 * 60 * 1000).toISOString().split('T')[0] : null,
        }
    }));

    console.log('Zero amount orders:', yeouidoOrders.filter(o => o.summary.total === 0).length);
    console.log('Transferred in orders (isProcess):', yeouidoOrders.filter(o => o.branch_name !== '여의도점').length);


    console.log('Details:', JSON.stringify(details, null, 2));
}
run();
