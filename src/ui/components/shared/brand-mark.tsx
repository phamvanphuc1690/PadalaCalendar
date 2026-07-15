import { Sparkles } from 'lucide-react';
import { cn } from '@/ui/lib/utils';

export function BrandMark({ className, label = 'PayHub' }: { className?: string; label?: string }) {
  return (
    <div className={cn('flex items-center gap-2 font-semibold', className)}>
      <span className="grid h-7 w-7 place-items-center rounded-md bg-primary text-primary-foreground">
        <Sparkles className="h-4 w-4" />
      </span>
      <span className="display-thin text-lg tracking-tight">{label}</span>
    </div>
  );
}
