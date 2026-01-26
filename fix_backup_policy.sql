
-- [1] 백업 버킷에 대한 접근 권한 설정 (RLS)
-- 이미 정책이 있다면 삭제하고 새로 만듭니다.
DROP POLICY IF EXISTS "Allow all access to backups" ON storage.objects;

-- 로그인한 사용자(authenticated)와 비로그인(anon) 모두에게 모든 권한 허용 (테스트용)
-- 보안을 위해 추후에 'authenticated'로 제한하는 것이 좋습니다.
CREATE POLICY "Allow all access to backups"
ON storage.objects FOR ALL
TO public
USING (bucket_id = 'backups')
WITH CHECK (bucket_id = 'backups');

-- [2] 버킷이 없는 경우 생성 (Optional)
INSERT INTO storage.buckets (id, name, public)
VALUES ('backups', 'backups', true)
ON CONFLICT (id) DO UPDATE SET public = true;
