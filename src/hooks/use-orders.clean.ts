const mapRowToOrder = (row: any): Order => ({
    id: row.id,
    branchId: row.branch_id,
    branchName: row.branch_name,
    orderNumber: row.order_number,
    orderDate: row.order_date,
    status: row.status,
    items: row.items || [],
    summary: row.summary || {},
    orderer: row.orderer || {},
    isAnonymous: row.is_anonymous || false,
    registerCustomer: row.register_customer || row.extra_data?.register_customer || false,
    orderType: row.order_type || row.extra_data?.order_type || "etc",
    receiptType: row.receipt_type,
    payment: row.payment || {},
    pickupInfo: row.pickup_info,
    deliveryInfo: row.delivery_info,
    actualDeliveryCost: row.actual_delivery_cost ?? row.extra_data?.actualDeliveryCost ?? row.extra_data?.actual_delivery_cost,
    actualDeliveryCostCash: row.actual_delivery_cost_cash ?? row.extra_data?.actualDeliveryCostCash ?? row.extra_data?.actual_delivery_cost_cash,
    deliveryCostStatus: row.delivery_cost_status ?? row.extra_data?.deliveryCostStatus ?? row.extra_data?.delivery_cost_status,
    deliveryCostUpdatedAt: row.delivery_cost_updated_at ?? row.extra_data?.deliveryCostUpdatedAt ?? row.extra_data?.delivery_cost_updated_at,
    deliveryCostUpdatedBy: row.delivery_cost_updated_by ?? row.extra_data?.deliveryCostUpdatedBy ?? row.extra_data?.delivery_cost_updated_by,
    deliveryCostReason: row.delivery_cost_reason ?? row.extra_data?.deliveryCostReason ?? row.extra_data?.delivery_cost_reason,
    deliveryProfit: row.delivery_profit ?? row.extra_data?.deliveryProfit ?? row.extra_data?.delivery_profit,
    message: (() => {
        const msg = (row.message && Object.keys(row.message).length > 0) ? row.message : (row.extra_data?.message || {});
        if (msg.type === 'ribbon' && !msg.content) {
            if (msg.ribbon_left || msg.ribbon_right) {
                msg.content = msg.ribbon_right || '';
                msg.sender = msg.ribbon_left || '';
            } else if (msg.start || msg.end) {
                msg.content = msg.end || '';
                msg.sender = msg.start || '';
            }
        }
        return msg;
    })(),
    request: row.request || row.extra_data?.request || '',
    source: row.source || row.extra_data?.source,
    transferInfo: row.transfer_info || row.extra_data?.transfer_info,
    outsourceInfo: row.outsource_info || row.extra_data?.outsource_info,
    extraData: row.extra_data
});

const fetchCalendarOrders = useCallback(async (baseDate: Date) => {
    try {
        setLoading(true);
        const startFilterDate = subDays(startOfDay(baseDate), 35).toISOString().split('T')[0];
        const { data, error } = await supabase
            .from('orders')
            .select('*')
            .or(`pickup_info->>date.gte.${startFilterDate},delivery_info->>date.gte.${startFilterDate},order_date.gte.${startFilterDate}`)
            .order('order_date', { ascending: false })
            .limit(2000);

        if (error) throw error;
        const ordersData = (data || []).map(mapRowToOrder);
        setOrders(ordersData);
        return ordersData;
    } catch (error) {
        console.error('캘린더 주문 로딩 오류:', error);
        return [];
    } finally {
        setLoading(false);
    }
}, []);
