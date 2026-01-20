
import { PrintPreviewClient } from './components/print-preview-client';

// Correctly type the props for a Next.js Page component with dynamic routes
interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PrintPreviewPage({ params }: PageProps) {
  const { id } = await params;
  return <PrintPreviewClient orderId={id} />;
}
