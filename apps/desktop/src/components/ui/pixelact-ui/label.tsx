import * as React from 'react';
import { cn } from '@/lib/utils';
import { Label as ShadcnLabel } from '@/components/ui/label';

import '@/components/ui/pixelact-ui/styles/styles.css';

interface PixelLabelProps extends React.ComponentProps<typeof ShadcnLabel> {
  asChild?: boolean;
}

function Label({ className, ...props }: PixelLabelProps) {
  return <ShadcnLabel className={cn('pixel-font text-foreground mb-2', className)} {...props} />;
}

export { Label };
