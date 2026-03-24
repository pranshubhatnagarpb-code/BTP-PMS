import { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { HelpCircle, Plus } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';

interface InfoCardProps {
  title: string;
  tooltip?: string;
  actionLabel?: string;
  onAction?: () => void;
  customAction?: ReactNode;
  children: ReactNode;
  className?: string;
}

export const InfoCard = ({
  title,
  tooltip,
  actionLabel,
  onAction,
  customAction,
  children,
  className,
}: InfoCardProps) => {
  return (
    <Card className={cn(
      "p-5 shadow-card hover:shadow-card-hover transition-shadow duration-200",
      className
    )}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-foreground">{title}</h3>
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
        {customAction}
        {!customAction && actionLabel && onAction && (
          <Button
            variant="link"
            size="sm"
            className="text-primary hover:text-primary/80 p-0 h-auto"
            onClick={onAction}
          >
            {actionLabel}
          </Button>
        )}
      </div>
      {children}
    </Card>
  );
};
