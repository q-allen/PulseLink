import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface BankTransferInstructionsProps {
  checkoutId: string;
  checkoutUrl: string;
}

export default function BankTransferInstructions({
  checkoutUrl,
}: BankTransferInstructionsProps) {
  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-4 space-y-3">
        <p className="text-sm font-medium text-foreground">Complete your card payment</p>
        <p className="text-xs text-muted-foreground">
          Click below to open the PayMongo checkout page and enter your Visa or Mastercard details.
          Your appointment will be confirmed once payment succeeds.
        </p>
        <Button
          className="w-full gap-2"
          onClick={() => window.open(checkoutUrl, '_blank', 'noopener,noreferrer')}
        >
          Continue to Card Payment
          <ExternalLink className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}
