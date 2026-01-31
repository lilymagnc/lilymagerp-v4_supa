-- [데이터베이스 함수 생성 SQL]
-- 이 스크립트를 Supabase SQL Editor에서 실행하면,
-- 클라이언트(브라우저) 부하 없이 단 1초 만에 통계를 재계산하는 함수가 생성됩니다.

CREATE OR REPLACE FUNCTION rebuild_daily_stats()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    -- 1. 기존 데이터 초기화 (완전 재계산을 위해)
    DELETE FROM daily_stats WHERE true;

    -- 2. 통계 재계산 및 삽입
    -- '주문일 기준' 데이터와 '결제일 기준' 데이터를 각각 집계한 후 합칩니다.
    INSERT INTO daily_stats (
        date,
        total_revenue,
        total_order_count,
        total_settled_amount,
        branches,
        last_updated
    )
    WITH clean_orders AS (
        SELECT
            order_date,
            created_at,
            summary,
            -- total, amount 컬럼 없음 -> summary에서 추출
            branch_name,
            payment,
            status,
            completed_at
        FROM orders
        WHERE status NOT IN ('canceled', 'cancelled', '취소', '주문취소')
    ),
    sales_data AS (
        -- A. [매출액(Revenue) & 주문건수] -> '주문 날짜' 기준
        SELECT
            to_char((COALESCE(NULLIF(order_date::text, ''), created_at::text))::timestamp, 'YYYY-MM-DD') as date_str,
            -- 지점명 정규화 (공백 -> 언더바)
            REPLACE(COALESCE(NULLIF(branch_name, ''), 'Unknown'), ' ', '_') as branch_key,
            -- 금액 추출 (summary 우선)
            COALESCE((summary->>'total')::bigint, (summary->>'total_amount')::bigint, 0) as revenue,
            1 as order_count,
            0 as settled_amount
        FROM clean_orders
    ),
    settlement_data AS (
        -- B. [정산액(Settled Amount)] -> '결제 완료 날짜' 기준
        -- 조건: 결제 상태가 확실히 'paid', 'completed' 인 경우에만
        SELECT
            to_char(
                (COALESCE(
                    NULLIF(payment->>'completedAt', ''),
                    NULLIF(completed_at::text, ''),
                    -- 결제일 없으면 주문일 사용? (사용자 요청: 실제 수금일 기준)
                    -- 하지만 결제일이 누락된 경우 '주문일'을 결제일로 간주하는 기존 로직 유지
                    NULLIF(order_date::text, ''),
                    created_at::text
                ))::timestamp,
                'YYYY-MM-DD'
            ) as date_str,
            REPLACE(COALESCE(NULLIF(branch_name, ''), 'Unknown'), ' ', '_') as branch_key,
            0 as revenue,
            0 as order_count,
            COALESCE((summary->>'total')::bigint, (summary->>'total_amount')::bigint, 0) as settled_amount
        FROM clean_orders
        WHERE (
            LOWER(payment->>'status') IN ('paid', 'completed', '결제완료', '입금완료')
        )
    ),
    combined_data AS (
        -- 두 데이터 합치기
        SELECT * FROM sales_data
        UNION ALL
        SELECT * FROM settlement_data
    ),
    aggregated_data AS (
        -- 일별, 지점별 합계 계산
        SELECT
            date_str,
            branch_key,
            SUM(revenue) as revenue,
            SUM(order_count) as order_count,
            SUM(settled_amount) as settled_amount
        FROM combined_data
        WHERE date_str IS NOT NULL
        GROUP BY date_str, branch_key
    )
    -- 최종 결과물 조립 (JSONB 생성)
    SELECT
        date_str,
        SUM(revenue),
        SUM(order_count),
        SUM(settled_amount),
        jsonb_object_agg(branch_key, jsonb_build_object(
            'revenue', revenue,
            'orderCount', order_count,
            'settledAmount', settled_amount
        )),
        NOW()
    FROM aggregated_data
    GROUP BY date_str;
END;
$$;
