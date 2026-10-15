import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '../lib/format';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger' | 'subtle';
  size?: 'sm' | 'md';
}

/** Кнопка дизайн-системы. variants: primary (accent), ghost (контур), danger, subtle. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'ghost', size = 'md', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none',
        size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-9 px-3.5 text-sm',
        variant === 'primary' && 'bg-accent/15 text-accent border border-accent/40 hover:bg-accent/25',
        variant === 'ghost' && 'border border-line text-ink hover:bg-elevated',
        variant === 'subtle' && 'text-muted hover:text-ink hover:bg-elevated',
        variant === 'danger' && 'border border-crit/40 text-crit hover:bg-crit/10',
        className,
      )}
      {...rest}
    />
  );
});
