import {BailManagerView} from './bail-manager-view';

type BailPageProps = {
  searchParams: Promise<{
    property_id?: string;
  }>;
};

export default async function BailPage({searchParams}: BailPageProps) {
  const params = await searchParams;

  return <BailManagerView selectedPropertyId={params.property_id} />;
}
