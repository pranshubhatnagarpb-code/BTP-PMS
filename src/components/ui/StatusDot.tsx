import { cn } from '@/lib/utils';

interface StatusDotProps {
  color: 'green' | 'yellow' | 'red' | 'black' | 'grey';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const StatusDot = ({ color, size = 'md', className }: StatusDotProps) => {
  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4'
  };

  const colorClasses = {
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500',
    black: 'bg-black',
    grey: 'bg-gray-400'
  };

  return (
    <div
      className={cn(
        'rounded-full',
        sizeClasses[size],
        colorClasses[color],
        className
      )}
    />
  );
};
