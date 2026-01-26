-- 배송비 동기화 트러블슈팅 및 복구 SQL
-- 이 쿼리를 실행하여 simple_expenses에만 존재하고 orders 테이블에 누락된 배송비 데이터를 동기화합니다.

-- 1. [진단] 불일치 데이터 확인
-- simple_expenses에는 'DELIVERY' 관련 지출이 있지만, orders에는 actual_delivery_cost가 0이거나 null인 주문 조회
-- 이 쿼리는 단순 조회용입니다. (orders.id와 simple_expenses.extra_data->>'relatedOrderId'를 연결)
-- 주의: simple_expenses에 related_order_id 컬럼이 명시적으로 없으면 extra_data를 확인해야 함. 
-- 스키마상 related_request_id만 보이고 related_order_id는 안보였으나, useSimpleExpenses 훅에서는 extra_data나 별도 필드에 저장할 수 있음.
-- 스키마를 다시 보니 related_request_id는 있지만 related_order_id는 없음.
-- 하지만 useSimpleExpenses 훅 호출부를 보면 `updateExpenseByOrderId`를 사용하는데, 이는 `extra_data->>'relatedOrderId'`를 사용할 가능성이 높음.

-- 2. [복구] simple_expenses 데이터를 기반으로 orders 업데이트
-- 관련 로직:
-- category = 'TRANSPORT'
-- sub_category = 'DELIVERY' (비현금성 배송비) 또는 'DELIVERY_CASH' (현금성 배송비)
-- extra_data ->> 'relatedOrderId' 가 orders.id와 매칭

-- 아래 쿼리는 PostgreSQL의 UPDATE ... FROM 구문을 사용합니다.

-- 2.1 비현금성 배송비(actual_delivery_cost) 업데이트
UPDATE orders
SET 
  actual_delivery_cost = s.amount,
  delivery_cost_status = 'completed',
  delivery_cost_updated_at = NOW(),
  delivery_cost_updated_by = 'system_migration'
FROM simple_expenses s
WHERE 
  -- simple_expenses의 extra_data에서 relatedOrderId를 추출하여 조인
  s.extra_data->>'relatedOrderId' = orders.id
  AND s.category = 'TRANSPORT'
  AND s.sub_category = 'DELIVERY'
  AND (orders.actual_delivery_cost IS NULL OR orders.actual_delivery_cost = 0);

-- 2.2 현금성 배송비(actual_delivery_cost_cash) 업데이트
UPDATE orders
SET 
  actual_delivery_cost_cash = s.amount,
  delivery_cost_status = 'completed' -- 이미 처리되었을 수 있으나 확실히 함
FROM simple_expenses s
WHERE 
  s.extra_data->>'relatedOrderId' = orders.id
  AND s.category = 'TRANSPORT'
  AND s.sub_category = 'DELIVERY_CASH'
  AND (orders.actual_delivery_cost_cash IS NULL OR orders.actual_delivery_cost_cash = 0);

-- 3. [확인] 업데이트된 주문 수 확인 (선택사항)
-- SELECT count(*) FROM orders WHERE delivery_cost_updated_by = 'system_migration';
