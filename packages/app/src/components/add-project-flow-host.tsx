import { CompanyProjectDialog } from "@/company/company-project-dialog";
import { useAddProjectFlowStore } from "@/stores/add-project-flow-store";

export function AddProjectFlowHost() {
  const request = useAddProjectFlowStore((state) => state.request);
  const close = useAddProjectFlowStore((state) => state.close);

  if (!request) return null;

  return <CompanyProjectDialog key={request.id} request={request} onClose={close} />;
}
