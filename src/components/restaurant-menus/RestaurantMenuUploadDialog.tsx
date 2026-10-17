import { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Upload, Loader2, X, ImageIcon, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { normalizeRestaurantName, RestaurantMenu, useSaveRestaurantMenu } from '@/hooks/useRestaurantMenus';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingMenus: RestaurantMenu[];
  prefill?: RestaurantMenu | null;
  onAnalyzed: (menu: RestaurantMenu) => void;
}

// Photos are downscaled before upload (see fileToDataUrl), so the original
// file size can be generous. PDFs are sent as is, so they get a tighter cap to
// keep the request payload reasonable.
const MAX_FILES = 20;
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
const MAX_PDF_SIZE = 15 * 1024 * 1024; // 15MB

const isPdf = (file: File) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

const readAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(`${file.name} couldn't be read.`));
    reader.readAsDataURL(file);
  });

// Menu text stays legible at this size, and it keeps the payload small and the
// OpenAI vision token cost low.
const MAX_IMAGE_DIMENSION = 2000;

// Re-encodes every photo as a downscaled JPEG. This also converts formats
// OpenAI rejects (e.g. HEIC from iPhones, where the browser can decode them).
const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Could not process image'));
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`${file.name} couldn't be read. Please upload a JPG or PNG photo.`));
    };
    img.src = url;
  });

export const RestaurantMenuUploadDialog = ({ open, onOpenChange, existingMenus, prefill, onAnalyzed }: Props) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [restaurantName, setRestaurantName] = useState('');
  const [location, setLocation] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const saveMenu = useSaveRestaurantMenu();

  useEffect(() => {
    if (open) {
      setRestaurantName(prefill?.restaurant_name || '');
      setLocation(prefill?.location || '');
      setFiles([]);
      setPreviews([]);
    }
  }, [open, prefill]);

  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  const existingMatch = restaurantName.trim()
    ? existingMenus.find((m) => m.restaurant_name_normalized === normalizeRestaurantName(restaurantName))
    : null;

  const handleFilesSelected = (selected: FileList | null) => {
    if (!selected) return;
    const incoming = Array.from(selected);
    const invalid = incoming.find((f) => !f.type.startsWith('image/') && !isPdf(f));
    if (invalid) {
      toast.error(`${invalid.name} isn't a photo or PDF. Please upload the menu as JPG/PNG photos or a PDF.`);
      return;
    }
    const tooBigPdf = incoming.find((f) => isPdf(f) && f.size > MAX_PDF_SIZE);
    if (tooBigPdf) {
      toast.error(`${tooBigPdf.name} is too large — please keep each PDF under 15MB.`);
      return;
    }
    const tooBig = incoming.find((f) => !isPdf(f) && f.size > MAX_FILE_SIZE);
    if (tooBig) {
      toast.error(`${tooBig.name} is too large — please keep each photo under 25MB.`);
      return;
    }
    const combined = [...files, ...incoming].slice(0, MAX_FILES);
    if (files.length + incoming.length > MAX_FILES) {
      toast.error(`You can upload up to ${MAX_FILES} files at a time.`);
    }
    setFiles(combined);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAnalyze = async () => {
    if (!restaurantName.trim()) {
      toast.error('Please enter the restaurant name');
      return;
    }
    if (files.length === 0) {
      toast.error('Please upload at least one photo or PDF of the menu');
      return;
    }

    setIsAnalyzing(true);
    try {
      const images = await Promise.all(files.map((f) => (isPdf(f) ? readAsDataUrl(f) : fileToDataUrl(f))));
      const { data, error } = await supabase.functions.invoke('analyze-restaurant-menu', {
        body: { restaurantName: restaurantName.trim(), images },
      });

      if (error) {
        // Non-2xx responses carry the function's real error message in the body.
        const body = await error.context?.json?.().catch(() => null);
        throw new Error(body?.error || error.message || 'Failed to analyze menu');
      }
      if (data?.error) throw new Error(data.error);
      if (!data?.healthyOptions || !data?.summaryText) throw new Error('Invalid response from server');

      const saved = await saveMenu.mutateAsync({
        restaurant_name: restaurantName.trim(),
        location: location.trim() || null,
        healthy_options: data.healthyOptions,
        summary_text: data.summaryText,
      });

      toast.success('Menu analyzed and saved for future reference!');
      onAnalyzed(saved);
      onOpenChange(false);
    } catch (err: any) {
      console.error('Menu analysis error:', err);
      toast.error(err.message || 'Failed to analyze menu');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isAnalyzing && onOpenChange(next)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Analyze Restaurant Menu</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="restaurant-name">Restaurant Name *</Label>
            <Input
              id="restaurant-name"
              value={restaurantName}
              onChange={(e) => setRestaurantName(e.target.value)}
              placeholder="e.g. Sharma Ji Dhaba"
              disabled={isAnalyzing}
            />
            {existingMatch && (
              <p className="text-xs text-warning">
                Already on file — analyzing will refresh the saved healthy options for "{existingMatch.restaurant_name}".
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="restaurant-location">Location (optional)</Label>
            <Input
              id="restaurant-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Bandra West"
              disabled={isAnalyzing}
            />
          </div>

          <div className="space-y-2">
            <Label>Menu Photos or PDF *</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf,.pdf"
              multiple
              className="hidden"
              onChange={(e) => handleFilesSelected(e.target.files)}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isAnalyzing || files.length >= MAX_FILES}
              className="w-full border-2 border-dashed border-border rounded-lg py-6 flex flex-col items-center gap-2 text-muted-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Upload className="h-6 w-6" />
              <span className="text-sm">Click to upload photos or a PDF of the menu</span>
              <span className="text-xs">Up to {MAX_FILES} files · photos up to 25MB, PDFs up to 15MB</span>
            </button>

            {previews.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 p-1.5 max-h-64 overflow-y-auto">
                {previews.map((url, i) => (
                  <div key={url} className="relative group">
                    {files[i] && isPdf(files[i]) ? (
                      <div className="h-20 w-full rounded-md border border-border bg-muted/40 flex flex-col items-center justify-center gap-1 px-1 text-muted-foreground">
                        <FileText className="h-5 w-5" />
                        <span className="text-[10px] leading-tight text-center line-clamp-2 break-all">{files[i].name}</span>
                      </div>
                    ) : (
                      <img src={url} alt={files[i]?.name} className="h-20 w-full object-cover rounded-md border border-border" />
                    )}
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      disabled={isAnalyzing}
                      className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full p-0.5 shadow"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {previews.length === 0 && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <ImageIcon className="h-3.5 w-3.5" />
                No files selected yet
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isAnalyzing}>
              Cancel
            </Button>
            <Button onClick={handleAnalyze} disabled={isAnalyzing}>
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                'Analyze Menu'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
