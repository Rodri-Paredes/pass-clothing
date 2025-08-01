import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Store, Eye, EyeOff } from 'lucide-react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { useAuthStore } from '../store/authStore';

interface LoginFormData {
  email: string;
  password: string;
}

interface SignUpFormData extends LoginFormData {
  name: string;
  confirmPassword: string;
}

const LoginPage: React.FC = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const { signIn, signUp } = useAuthStore();
  
  const { register, handleSubmit, formState: { errors }, watch, reset } = useForm<SignUpFormData>();

  const onSubmit = async (data: SignUpFormData) => {
    setError('');
    setIsLoading(true);

    try {
      if (isSignUp) {
        if (data.password !== data.confirmPassword) {
          setError('Las contraseñas no coinciden');
          return;
        }
        await signUp(data.email, data.password, data.name);
      } else {
        await signIn(data.email, data.password);
      }
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    setError('');
    reset();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="bg-blue-600 p-3 rounded-full">
              <Store className="h-8 w-8 text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">PASS STORE </h1>
          <p className="text-gray-600 mt-2">
            {isSignUp ? 'Crear nueva cuenta' : 'Inicia sesión en tu cuenta'}
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

          {isSignUp && (
            <div>
              <Input
                label="Nombre completo"
                type="text"
                {...register('name', { required: 'El nombre es requerido' })}
                error={errors.name?.message}
              />
              {errors.name && (
                <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>
              )}
            </div>
          )}

          <div>
            <Input
              label="Correo electrónico"
              type="email"
              {...register('email', { 
                required: 'El correo es requerido',
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: 'Correo electrónico inválido'
                }
              })}
              error={errors.email?.message}
            />
            {errors.email && (
              <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>
            )}
          </div>

          <div className="relative">
            <Input
              label="Contraseña"
              type={showPassword ? 'text' : 'password'}
              {...register('password', { 
                required: 'La contraseña es requerida',
                minLength: {
                  value: 6,
                  message: 'La contraseña debe tener al menos 6 caracteres'
                }
              })}
              error={errors.password?.message}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-8 text-gray-400 hover:text-gray-600"
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
            {errors.password && (
              <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>
            )}
          </div>

          {isSignUp && (
            <div>
              <Input
                label="Confirmar contraseña"
                type="password"
                {...register('confirmPassword', { 
                  required: 'Confirma tu contraseña',
                  validate: value => value === watch('password') || 'Las contraseñas no coinciden'
                })}
                error={errors.confirmPassword?.message}
              />
              {errors.confirmPassword && (
                <p className="text-red-500 text-xs mt-1">{errors.confirmPassword.message}</p>
              )}
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            isLoading={isLoading}
          >
            {isSignUp ? 'Crear Cuenta' : 'Iniciar Sesión'}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={toggleMode}
            className="text-blue-600 hover:text-blue-700 font-medium transition-colors"
          >
            {isSignUp
              ? '¿Ya tienes cuenta? Inicia sesión'
              : '¿No tienes cuenta? Crear una cuenta nueva'
            }
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;