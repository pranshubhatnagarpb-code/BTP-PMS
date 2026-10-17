// "Download PDF" button that asks which of the clinic's two layouts to use.
import { ReactNode } from 'react';
import { ChevronDown, Download } from 'lucide-react';
import { Button, ButtonProps } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DIET_DOCUMENT_FORMATS, DietDocumentFormat } from '@/lib/dietPlanDocument';

const FORMAT_HINTS: Record<DietDocumentFormat, string> = {
  tabular: 'Landscape · one table per day',
  open: 'Portrait · one table, options by day',
};

interface Props extends Omit<ButtonProps, 'onClick'> {
  onDownload: (format: DietDocumentFormat) => void;
  children?: ReactNode;
}

export const DietPlanDownloadMenu = ({ onDownload, children, ...buttonProps }: Props) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button {...buttonProps}>
        {children ?? (
          <>
            <Download className="h-4 w-4 mr-2" />
            Download PDF
            <ChevronDown className="h-4 w-4 ml-1 opacity-70" />
          </>
        )}
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start">
      {DIET_DOCUMENT_FORMATS.map((f) => (
        <DropdownMenuItem key={f.value} onSelect={() => onDownload(f.value)} className="flex-col items-start">
          <span className="font-medium">{f.label}</span>
          <span className="text-xs text-muted-foreground">{FORMAT_HINTS[f.value]}</span>
        </DropdownMenuItem>
      ))}
    </DropdownMenuContent>
  </DropdownMenu>
);
