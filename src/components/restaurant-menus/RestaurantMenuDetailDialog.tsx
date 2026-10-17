import { useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Copy, Download, MapPin, Salad } from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { RestaurantMenu } from '@/hooks/useRestaurantMenus';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  menu: RestaurantMenu | null;
}

export const RestaurantMenuDetailDialog = ({ open, onOpenChange, menu }: Props) => {
  const contentRef = useRef<HTMLDivElement>(null);

  if (!menu) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(menu.summary_text);
      toast.success('Copied — ready to paste and send to the client.');
    } catch {
      toast.error('Could not copy to clipboard.');
    }
  };

  const handleDownloadPDF = async () => {
    const element = contentRef.current;
    if (!element) return;
    const toastId = toast.loading('Generating PDF...');
    try {
      const canvas = await html2canvas(element, { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const fileName = `${menu.restaurant_name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_healthy_options.pdf`;
      pdf.save(fileName);
      toast.success('PDF downloaded successfully!', { id: toastId });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate PDF', { id: toastId });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{menu.restaurant_name}</DialogTitle>
        </DialogHeader>

        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5">
            <Copy className="h-3.5 w-3.5" />
            Copy for Client
          </Button>
          <Button size="sm" onClick={handleDownloadPDF} className="gap-1.5">
            <Download className="h-3.5 w-3.5" />
            Download PDF
          </Button>
        </div>

        <div ref={contentRef} className="space-y-4 bg-background p-1">
          <div>
            <h3 className="text-lg font-semibold text-foreground">{menu.restaurant_name}</h3>
            {menu.location && (
              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                <MapPin className="h-3.5 w-3.5" />
                {menu.location}
              </p>
            )}
          </div>

          {menu.healthy_options.length === 0 ? (
            <p className="text-sm text-muted-foreground">No standout healthy options were identified on this menu.</p>
          ) : (
            <div className="space-y-3">
              {menu.healthy_options.map((option, i) => (
                <Card key={i}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2">
                        <Salad className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-foreground">{option.name}</p>
                          {option.description && (
                            <p className="text-sm text-muted-foreground mt-0.5">{option.description}</p>
                          )}
                          <p className="text-sm text-success mt-1">{option.whyHealthy}</p>
                        </div>
                      </div>
                      {option.estimatedCalories && (
                        <span className="text-xs text-muted-foreground whitespace-nowrap">~{option.estimatedCalories}</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <Card className="bg-muted/40">
            <CardContent className="pt-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Message for client</p>
              <p className="text-sm text-foreground whitespace-pre-wrap">{menu.summary_text}</p>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};
