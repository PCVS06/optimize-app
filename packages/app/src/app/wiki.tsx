import { HostRouteBootstrapBoundary } from "@/components/host-route-bootstrap-boundary";
import { OptimizeWikiScreen } from "@/screens/optimize-wiki-screen";

export default function WikiRoute() {
  return (
    <HostRouteBootstrapBoundary>
      <OptimizeWikiScreen />
    </HostRouteBootstrapBoundary>
  );
}
