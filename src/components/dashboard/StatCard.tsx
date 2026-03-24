import { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface StatCardProps {
  title: string;
  value?: string | number;
  subtitle?: string;
  change?: {
    value: string;
    isPositive: boolean;
  };
  icon?: ReactNode;
  tooltip?: string;
  className?: string;
  highlight?: 'success' | 'warning' | 'danger';
  children?: ReactNode;
}

export const StatCard = ({
  title,
  value,
  subtitle,
  change,
  icon,
  tooltip,
  className,
  highlight,
  children,
}: StatCardProps) => {
  return (
    <Card className={cn(
      "p-5 shadow-card hover:shadow-card-hover transition-shadow duration-200",
      className
    )}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
          {tooltip && (
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="h-4 w-4 text-muted-foreground/50" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">{tooltip}</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </div>
      
      <div className="mt-3">
        {value !== undefined && value !== '' && (
          <p className={cn(
            "text-2xl font-bold",
            highlight === 'success' && "text-success",
            highlight === 'warning' && "text-warning",
            highlight === 'danger' && "text-destructive",
            !highlight && "text-foreground"
          )}>
            {value}
          </p>
        )}
        
        {children}
        
        {subtitle && (
          <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
        )}
        
        {change && (
          <p className={cn(
            "text-sm font-medium mt-1",
            change.isPositive ? "text-success" : "text-destructive"
          )}>
            {change.isPositive ? '+' : ''}{change.value}
            <span className="text-muted-foreground font-normal ml-1">(From last month)</span>
          </p>
        )}
      </div>
    </Card>
  );
};
