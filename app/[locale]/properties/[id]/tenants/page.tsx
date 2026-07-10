import {BailManagerView} from '../../../bail/bail-manager-view';

type PropertyTenantsPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function PropertyTenantsPage({params}: PropertyTenantsPageProps) {
  const {id} = await params;

  return <BailManagerView selectedPropertyId={id} source="property" />;
}
