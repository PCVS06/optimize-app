import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  StyleSheet as RNStyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { StyleSheet, withUnistyles } from "react-native-unistyles";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BookOpen, Settings, X } from "lucide-react-native";
import { router, usePathname } from "expo-router";
import { Gesture } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { TitlebarDragRegion } from "@/components/desktop/titlebar-drag-region";
import { resolveDesktopSidebarWidth } from "@/components/desktop-sidebar-layout";
import {
  SIDEBAR_RESIZE_ACTIVATION_OFFSET,
  SIDEBAR_RESIZE_FAIL_OFFSET,
} from "@/components/sidebar-resize-handle-layout";
import { SidebarResizeHandle } from "@/components/sidebar-resize-handle";
import { SidebarNavRows } from "@/components/sidebar/sidebar-nav-rows";
import { SidebarHelpMenu } from "@/components/sidebar/sidebar-help-menu";
import { SidebarAgentListSkeleton } from "@/components/sidebar-agent-list-skeleton";
import { RetainedPanelActivity } from "@/components/retained-panel";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HEADER_INNER_HEIGHT, useIsCompactFormFactor } from "@/constants/layout";
import { useSidebarWorkspacesList } from "@/hooks/use-sidebar-workspaces-list";
import { usePanelStore } from "@/stores/panel-store";
import { useOwnsWindowChromeCorner, WindowChromeSafeArea } from "@/utils/desktop-window";
import { useCloseAgentListGesture } from "@/mobile-panels/gestures";
import { MobilePanelOverlay } from "@/mobile-panels/presentation";
import { buildSettingsRoute } from "@/utils/host-routes";
import { CompanySidebarList } from "@/company/company-sidebar-list";

const BookIcon = withUnistyles(BookOpen, (theme) => ({ color: theme.colors.foregroundMuted }));
const SettingsIcon = withUnistyles(Settings, (theme) => ({ color: theme.colors.foregroundMuted }));
const CloseIcon = withUnistyles(X, (theme) => ({ color: theme.colors.foregroundMuted }));

export const LeftSidebar = memo(function LeftSidebar({ active }: { active: boolean }) {
  const isCompact = useIsCompactFormFactor();
  const insets = useSafeAreaInsets();
  const { isInitialLoad } = useSidebarWorkspacesList({ enabled: active, hostFilters: [] });
  const close = useCallback(
    () => usePanelStore.getState().closeAgentListForLayout({ isCompact: true }),
    [],
  );
  const content = (
    <SidebarContent
      compact={isCompact}
      loading={isInitialLoad}
      onNavigate={isCompact ? close : undefined}
    />
  );
  return (
    <RetainedPanelActivity active={active}>
      {isCompact ? (
        <MobileSidebar insetsTop={insets.top} insetsBottom={insets.bottom} onClose={close}>
          {content}
        </MobileSidebar>
      ) : (
        <DesktopSidebar active={active} insetsTop={insets.top}>
          {content}
        </DesktopSidebar>
      )}
    </RetainedPanelActivity>
  );
});

function SidebarContent({
  compact,
  loading,
  onNavigate,
}: {
  compact: boolean;
  loading: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const openWiki = useCallback(() => {
    onNavigate?.();
    router.navigate("/wiki");
  }, [onNavigate]);
  const openSettings = useCallback(() => {
    onNavigate?.();
    router.push(buildSettingsRoute());
  }, [onNavigate]);
  return (
    <View style={styles.content}>
      {compact ? <WindowChromeSafeArea placement="below" /> : null}
      <SidebarNavRows style={styles.nav} onBeforeNavigate={onNavigate} />
      {loading ? <SidebarAgentListSkeleton /> : <CompanySidebarList onNavigate={onNavigate} />}
      <View style={styles.footer}>
        <Text style={styles.brand}>Optimize</Text>
        <View style={styles.footerIcons}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Pressable
                style={[styles.iconButton, pathname === "/wiki" && styles.iconActive]}
                accessibilityRole="button"
                accessibilityLabel="Optimize Wiki"
                testID="sidebar-optimize-wiki"
                onPress={openWiki}
              >
                <BookIcon size={19} />
              </Pressable>
            </TooltipTrigger>
            <TooltipContent>
              <Text style={styles.tooltipText}>Optimize Wiki</Text>
            </TooltipContent>
          </Tooltip>
          <SidebarHelpMenu />
          <Tooltip>
            <TooltipTrigger asChild>
              <Pressable
                style={styles.iconButton}
                accessibilityRole="button"
                accessibilityLabel="Settings"
                testID="sidebar-settings"
                onPress={openSettings}
              >
                <SettingsIcon size={19} />
              </Pressable>
            </TooltipTrigger>
            <TooltipContent>
              <Text style={styles.tooltipText}>Settings</Text>
            </TooltipContent>
          </Tooltip>
        </View>
      </View>
    </View>
  );
}

function MobileSidebar({
  children,
  insetsTop,
  insetsBottom,
  onClose,
}: {
  children: React.ReactNode;
  insetsTop: number;
  insetsBottom: number;
  onClose: () => void;
}) {
  const { gesture } = useCloseAgentListGesture();
  return (
    <MobilePanelOverlay
      panel="agent-list"
      closeGesture={gesture}
      panelStyle={[styles.panel, { paddingTop: insetsTop, paddingBottom: insetsBottom }]}
    >
      {children}
      <Pressable
        onPress={onClose}
        style={styles.close}
        accessibilityRole="button"
        accessibilityLabel="Close sidebar"
        testID="sidebar-close"
      >
        <CloseIcon size={19} />
      </Pressable>
    </MobilePanelOverlay>
  );
}

function DesktopSidebar({
  children,
  active,
  insetsTop,
}: {
  children: React.ReactNode;
  active: boolean;
  insetsTop: number;
}) {
  const ownsTopLeft = useOwnsWindowChromeCorner("top-left");
  const sidebarWidth = usePanelStore((state) => state.sidebarWidth);
  const setSidebarWidth = usePanelStore((state) => state.setSidebarWidth);
  const { width: viewportWidth } = useWindowDimensions();
  const visibleWidth = resolveDesktopSidebarWidth({ requestedWidth: sidebarWidth, viewportWidth });
  const startWidthRef = useRef(visibleWidth);
  const resizeWidth = useSharedValue(visibleWidth);
  const [pressed, setPressed] = useState(false);
  const showGrip = useCallback(() => setPressed(true), []);
  const hideGrip = useCallback(() => setPressed(false), []);
  useEffect(() => {
    resizeWidth.value = visibleWidth;
  }, [resizeWidth, visibleWidth]);
  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .hitSlop({ left: 8, right: 8, top: 0, bottom: 0 })
        .onBegin(() => {
          scheduleOnRN(showGrip);
        })
        .activeOffsetX([-SIDEBAR_RESIZE_ACTIVATION_OFFSET, SIDEBAR_RESIZE_ACTIVATION_OFFSET])
        .failOffsetY([-SIDEBAR_RESIZE_FAIL_OFFSET, SIDEBAR_RESIZE_FAIL_OFFSET])
        .onStart((event) => {
          startWidthRef.current = visibleWidth - event.translationX;
          resizeWidth.value = visibleWidth;
        })
        .onUpdate((event) => {
          resizeWidth.value = resolveDesktopSidebarWidth({
            requestedWidth: startWidthRef.current + event.translationX,
            viewportWidth,
          });
        })
        .onEnd(() => {
          runOnJS(setSidebarWidth)(resizeWidth.value);
        })
        .onFinalize(() => {
          scheduleOnRN(hideGrip);
        }),
    [hideGrip, resizeWidth, setSidebarWidth, showGrip, viewportWidth, visibleWidth],
  );
  const widthStyle = useAnimatedStyle(() => ({ width: resizeWidth.value }));
  return (
    <Animated.View
      accessibilityElementsHidden={!active}
      importantForAccessibility={active ? "auto" : "no-hide-descendants"}
      pointerEvents={active ? "auto" : "none"}
      style={[staticStyles.desktop, !active && staticStyles.hidden, widthStyle]}
    >
      <View style={[styles.panel, { paddingTop: insetsTop }]}>
        {ownsTopLeft ? (
          <View style={styles.chrome}>
            <TitlebarDragRegion />
          </View>
        ) : null}
        {children}
        <SidebarResizeHandle
          edge="right"
          gesture={gesture}
          pressed={pressed}
          testID="left-sidebar-resize-handle"
        />
      </View>
    </Animated.View>
  );
}
const staticStyles = RNStyleSheet.create({
  desktop: { position: "relative" },
  hidden: { display: "none" },
});
const styles = StyleSheet.create((theme) => ({
  panel: {
    flex: 1,
    minHeight: 0,
    backgroundColor: theme.colors.surfaceSidebar,
    borderRightWidth: 1,
    borderRightColor: theme.colors.border,
  },
  content: { flex: 1, minHeight: 0 },
  chrome: { height: HEADER_INNER_HEIGHT, position: "relative" },
  nav: { gap: 2, paddingTop: 6, paddingBottom: 8 },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  brand: { flex: 1, fontSize: 13, fontWeight: "500", color: theme.colors.foregroundMuted },
  footerIcons: { flexDirection: "row", alignItems: "center", gap: 7 },
  iconButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  iconActive: { backgroundColor: theme.colors.surfaceSidebarHover },
  tooltipText: { color: theme.colors.foreground, fontSize: 13 },
  close: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
}));
