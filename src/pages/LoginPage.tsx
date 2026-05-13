import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { ShoppingBag, Eye, EyeOff, AlertCircle } from 'lucide-react';
import Button from '../components/ui/Button';
import { useAuthStore } from '../store/authStore';

interface LoginFormData {
  email: string;
  password: string;
}

const LoginPage: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { signIn } = useAuthStore();
  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormData>();

  const onSubmit = async (data: LoginFormData) => {
    setError('');
    setIsLoading(true);
    try {
      await signIn(data.email, data.password);
    } catch (err: any) {
      setError(err.message || 'Credenciales incorrectas');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel — brand */}
      <div className="hidden lg:flex flex-col justify-between w-[420px] flex-shrink-0 bg-[#0f172a] px-10 py-12">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-brand-600 rounded-xl shadow-glow-brand">
            <ShoppingBag className="h-5 w-5 text-white" />
          </div>
          <span className="text-white font-bold text-lg tracking-tight">PASS STORE</span>
        </div>

        <div>
          <p className="text-slate-400 text-sm font-medium uppercase tracking-widest mb-4">
            Sistema ERP
          </p>
          <h2 className="text-white text-4xl font-bold leading-tight mb-4">
            Gestiona tu tienda<br/>
            <span className="text-brand-400">sin complicaciones</span>
          </h2>
          <p className="text-slate-400 text-base leading-relaxed">
            Control de inventario, ventas, caja y reportes en un solo lugar.
          </p>

          <div className="mt-10 grid grid-cols-2 gap-4">
            {[
              { n: '3', label: 'Sucursales' },
              { n: '225+', label: 'Productos' },
              { n: '3K+', label: 'Ventas' },
              { n: '99%', label: 'Uptime' },
            ].map(s => (
              <div key={s.label} className="bg-white/5 rounded-xl p-4 border border-white/8">
                <p className="text-white text-2xl font-bold">{s.n}</p>
                <p className="text-slate-400 text-xs mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-slate-600 text-xs">© 2025 PASS Clothing · Todos los derechos reservados</p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center bg-surface-50 p-6">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-3 mb-10">
            <div className="p-2.5 bg-brand-600 rounded-xl">
              <ShoppingBag className="h-5 w-5 text-white" />
            </div>
            <span className="text-surface-900 font-bold text-lg">PASS STORE</span>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-surface-900 mb-1">Bienvenido</h1>
            <p className="text-surface-500 text-sm">Ingresa con tu cuenta de vendedor</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1.5">
                Correo electrónico
              </label>
              <input
                type="email"
                autoComplete="email"
                placeholder="tu@correo.com"
                {...register('email', {
                  required: 'El correo es requerido',
                  pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Correo inválido' },
                })}
                className={`w-full h-10 px-3 text-sm rounded-lg border bg-white transition-all
                  focus:outline-none focus:ring-2 focus:ring-brand-500/25 focus:border-brand-500
                  ${errors.email ? 'border-red-400' : 'border-surface-300 hover:border-surface-400'}`}
              />
              {errors.email && (
                <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />{errors.email.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  {...register('password', { required: 'La contraseña es requerida' })}
                  className={`w-full h-10 pl-3 pr-10 text-sm rounded-lg border bg-white transition-all
                    focus:outline-none focus:ring-2 focus:ring-brand-500/25 focus:border-brand-500
                    ${errors.password ? 'border-red-400' : 'border-surface-300 hover:border-surface-400'}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />{errors.password.message}
                </p>
              )}
            </div>

            {error && (
              <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <Button type="submit" className="w-full mt-2" size="md" isLoading={isLoading}>
              Iniciar sesión
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;