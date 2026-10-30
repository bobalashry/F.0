import { AuthForm } from '@/components/auth/auth-form';

export default function SignUpPage() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <AuthForm mode="signup" />
    </div>
  );
}
