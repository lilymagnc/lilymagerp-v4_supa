
"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import Image from 'next/image';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Firebase Auth가 초기화되었는지 확인
    if (!auth) {
      console.error('Firebase Auth is not initialized');
      toast({
        variant: 'destructive',
        title: '로그인 실패',
        description: 'Firebase가 초기화되지 않았습니다. 페이지를 새로고침해주세요.',
      });
      setLoading(false);
      return;
    }

    try {

      await signInWithEmailAndPassword(auth, email, password);
      // 로그인 성공 시 lastLogin 업데이트
      try {
        const userRef = doc(db, "users", email);
        await updateDoc(userRef, {
          lastLogin: serverTimestamp()
        });
      } catch (updateError) {
        console.warn("lastLogin 업데이트 실패:", updateError);
        // lastLogin 업데이트 실패해도 로그인은 계속 진행
      }
      router.push('/dashboard');
    } catch (error: any) {
      console.error('Login error details:', error);
      let errorMessage = '로그인에 실패했습니다.';

      // Firebase Auth 오류 코드에 따른 메시지
      if (error.code) {
        switch (error.code) {
          case 'auth/user-not-found':
            errorMessage = '등록되지 않은 이메일입니다.';
            break;
          case 'auth/wrong-password':
            errorMessage = '비밀번호가 올바르지 않습니다.';
            break;
          case 'auth/invalid-email':
            errorMessage = '올바르지 않은 이메일 형식입니다.';
            break;
          case 'auth/user-disabled':
            errorMessage = '비활성화된 계정입니다.';
            break;
          case 'auth/too-many-requests':
            errorMessage = '너무 많은 로그인 시도가 있었습니다. 잠시 후 다시 시도해주세요.';
            break;
          case 'auth/network-request-failed':
            errorMessage = '네트워크 연결을 확인해주세요.';
            break;
          default:
            errorMessage = `로그인 오류: ${error.message}`;
        }
      }

      toast({
        variant: 'destructive',
        title: '로그인 실패',
        description: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="mx-auto w-full max-w-sm">
        <div className="flex justify-center py-6">
          <Image
            src="https://ecimg.cafe24img.com/pg1472b45444056090/lilymagflower/web/upload/category/logo/v2_d13ecd48bab61a0269fab4ecbe56ce07_lZMUZ1lORo_top.jpg"
            alt="Logo"
            width={200}
            height={50}
            className="w-48 h-auto"
            priority
          />
        </div>
        <CardContent>
          <form onSubmit={handleLogin} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">이메일</Label>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">비밀번호</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute inset-y-0 right-0 flex items-center px-3"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                  <span className="sr-only">{showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}</span>
                </Button>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              로그인
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
