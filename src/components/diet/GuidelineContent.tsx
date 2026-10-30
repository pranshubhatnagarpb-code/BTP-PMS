// Shows an imported guideline's (already sanitised) HTML with readable styling.
import { cn } from '@/lib/utils';

export const GuidelineContent = ({ html, className }: { html: string; className?: string }) => (
  <div
    className={cn(
      'text-sm leading-relaxed text-foreground',
      '[&_p]:my-1.5 [&_strong]:font-semibold [&_a]:text-primary [&_a]:underline',
      '[&_h1]:mt-3 [&_h1]:text-lg [&_h1]:font-bold [&_h2]:mt-3 [&_h2]:text-base [&_h2]:font-bold [&_h3]:mt-2 [&_h3]:font-semibold',
      '[&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5',
      '[&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:p-2 [&_td]:align-top [&_th]:border [&_th]:p-2',
      '[&_tr:first-child_td]:bg-muted/60 [&_img]:my-2 [&_img]:max-w-full',
      className,
    )}
    // Content is sanitised on import (sanitizeGuidelineHtml).
    dangerouslySetInnerHTML={{ __html: html }}
  />
);
