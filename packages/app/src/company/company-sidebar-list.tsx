import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { StyleSheet, withUnistyles } from "react-native-unistyles";
import { ChevronDown, ChevronRight, Folder, MoreHorizontal, Plus, Pin } from "lucide-react-native";
import { router } from "expo-router";
import { useShallow } from "zustand/shallow";
import { useHosts, getHostRuntimeStore, useHostRuntimeClient } from "@/runtime/host-runtime";
import {
  useSessionStore,
  normalizeProjectDescriptor,
  normalizeWorkspaceDescriptor,
} from "@/stores/session-store";
import {
  navigateToWorkspace,
  useActiveWorkspaceSelection,
} from "@/stores/navigation-active-workspace-store";
import { buildNewWorkspaceRoute } from "@/utils/host-routes";
import { openProjectSettings } from "@/navigation/settings-navigation";
import { useOpenAddProject } from "@/hooks/use-open-add-project";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AdaptiveModalSheet } from "@/components/adaptive-modal-sheet";
import { Button } from "@/components/ui/button";
import { Field, FormTextInput } from "@/components/ui/form-field";
import { useToast } from "@/contexts/toast-context";
import { buildCompanySidebar, type CompanyChatRow, type CompanyProjectRow } from "./sidebar-model";

const FolderIcon = withUnistyles(Folder, (theme) => ({ color: theme.colors.foregroundMuted }));
const DownIcon = withUnistyles(ChevronDown, (theme) => ({ color: theme.colors.foregroundMuted }));
const RightIcon = withUnistyles(ChevronRight, (theme) => ({ color: theme.colors.foregroundMuted }));
const MoreIcon = withUnistyles(MoreHorizontal, (theme) => ({
  color: theme.colors.foregroundMuted,
}));
const PlusIcon = withUnistyles(Plus, (theme) => ({ color: theme.colors.foregroundMuted }));
const PinIcon = withUnistyles(Pin, (theme) => ({ color: theme.colors.foregroundMuted }));

interface CompanySidebarListProps {
  onNavigate?: () => void;
}
interface ChatRowProps extends CompanySidebarListProps {
  chat: CompanyChatRow;
  projects: CompanyProjectRow[];
  nested?: boolean;
}
interface ProjectRowProps extends CompanySidebarListProps {
  project: CompanyProjectRow;
  projects: CompanyProjectRow[];
}
interface ChatSheetProps {
  mode: "rename" | "move";
  chat: CompanyChatRow;
  projects: CompanyProjectRow[];
  onClose: () => void;
}

export function CompanySidebarList({ onNavigate }: CompanySidebarListProps) {
  const hosts = useHosts();
  const projectMaps = useSessionStore(
    useShallow((state) => hosts.map((host) => state.sessions[host.serverId]?.projects)),
  );
  const workspaceMaps = useSessionStore(
    useShallow((state) => hosts.map((host) => state.sessions[host.serverId]?.workspaces)),
  );
  const agentMaps = useSessionStore(
    useShallow((state) => hosts.map((host) => state.sessions[host.serverId]?.agents)),
  );
  const model = useMemo(
    () =>
      buildCompanySidebar(
        hosts.map((host, index) => ({
          serverId: host.serverId,
          projects: projectMaps[index]?.values() ?? [],
          workspaces: workspaceMaps[index]?.values() ?? [],
          agents: agentMaps[index]?.values() ?? [],
        })),
      ),
    [hosts, projectMaps, workspaceMaps, agentMaps],
  );
  const addProject = useOpenAddProject();
  const handleAddProject = useCallback(() => addProject(), [addProject]);
  return (
    <ScrollView
      style={styles.list}
      contentContainerStyle={styles.content}
      testID="company-sidebar-list"
    >
      {model.pinned.length ? (
        <PinnedChats chats={model.pinned} projects={model.projects} onNavigate={onNavigate} />
      ) : null}
      <View style={styles.heading}>
        <Text style={styles.headingText}>Chats</Text>
      </View>
      {model.chats.length ? (
        model.chats.map((chat) => (
          <ChatRow key={chat.key} chat={chat} projects={model.projects} onNavigate={onNavigate} />
        ))
      ) : (
        <Text style={styles.empty}>Your conversations appear here.</Text>
      )}
      <View style={styles.heading}>
        <Text style={styles.headingText}>Projects</Text>
        <View style={styles.grow} />
        <Pressable
          style={styles.smallButton}
          accessibilityRole="button"
          accessibilityLabel="New project"
          onPress={handleAddProject}
          testID="company-add-project"
        >
          <PlusIcon size={16} />
        </Pressable>
      </View>
      {model.projects.length ? (
        model.projects.map((project) => (
          <ProjectRow
            key={project.key}
            project={project}
            projects={model.projects}
            onNavigate={onNavigate}
          />
        ))
      ) : (
        <Text style={styles.empty}>Group related work in a project.</Text>
      )}
    </ScrollView>
  );
}

interface PinnedChatsProps extends CompanySidebarListProps {
  chats: CompanyChatRow[];
  projects: CompanyProjectRow[];
}
function PinnedChats({ chats, projects, onNavigate }: PinnedChatsProps) {
  return (
    <>
      <View style={styles.heading}>
        <PinIcon size={13} />
        <Text style={styles.headingText}>Pinned</Text>
      </View>
      {chats.map((chat) => (
        <ChatRow key={chat.key} chat={chat} projects={projects} onNavigate={onNavigate} />
      ))}
    </>
  );
}

function ProjectRow({ project, projects, onNavigate }: ProjectRowProps) {
  const [collapsed, setCollapsed] = useState(false);
  const toggle = useCallback(() => setCollapsed((value) => !value), []);
  const openSettings = useCallback(() => {
    onNavigate?.();
    openProjectSettings(project.serverId, project.projectId);
  }, [onNavigate, project]);
  const createChat = useCallback(() => {
    onNavigate?.();
    router.push(
      buildNewWorkspaceRoute({ serverId: project.serverId, projectId: project.projectId }),
    );
  }, [onNavigate, project]);
  const expandedState = useMemo(() => ({ expanded: !collapsed }), [collapsed]);
  return (
    <View>
      <View style={styles.projectRow}>
        <Pressable
          style={styles.projectMain}
          accessibilityRole="button"
          accessibilityState={expandedState}
          onPress={toggle}
        >
          {collapsed ? <RightIcon size={13} /> : <DownIcon size={13} />}
          <FolderIcon size={18} />
          <Text numberOfLines={1} style={styles.projectName}>
            {project.name}
          </Text>
        </Pressable>
        <Pressable
          style={styles.smallButton}
          accessibilityRole="button"
          accessibilityLabel={`Settings for ${project.name}`}
          onPress={openSettings}
        >
          <MoreIcon size={17} />
        </Pressable>
      </View>
      {!collapsed ? (
        <ProjectChats
          project={project}
          projects={projects}
          onNavigate={onNavigate}
          onCreateChat={createChat}
        />
      ) : null}
    </View>
  );
}
interface ProjectChatsProps extends ProjectRowProps {
  onCreateChat: () => void;
}
function ProjectChats({ project, projects, onNavigate, onCreateChat }: ProjectChatsProps) {
  return (
    <View style={styles.projectChats}>
      {project.chats.map((chat) => (
        <ChatRow key={chat.key} chat={chat} projects={projects} onNavigate={onNavigate} nested />
      ))}
      <Button
        variant="ghost"
        size="sm"
        leftIcon={Plus}
        onPress={onCreateChat}
        style={styles.newProjectChat}
        testID={`company-new-chat-${project.projectId}`}
      >
        New chat
      </Button>
    </View>
  );
}

function ChatRow({ chat, projects, nested, onNavigate }: ChatRowProps) {
  const active = useActiveWorkspaceSelection();
  const client = useHostRuntimeClient(chat.serverId);
  const toast = useToast();
  const [sheet, setSheet] = useState<"rename" | "move" | null>(null);
  const closeSheet = useCallback(() => setSheet(null), []);
  const rename = useCallback(() => setSheet("rename"), []);
  const move = useCallback(() => setSheet("move"), []);
  const open = useCallback(() => {
    onNavigate?.();
    navigateToWorkspace({ serverId: chat.serverId, workspaceId: chat.workspaceId });
  }, [onNavigate, chat]);
  const pin = useCallback(async () => {
    if (!client) return;
    try {
      await client.setWorkspacePinned(chat.workspaceId, !chat.pinned);
    } catch (error) {
      toast.show(error instanceof Error ? error.message : "Could not pin chat.", {
        variant: "error",
      });
    }
  }, [chat, client, toast]);
  const archive = useCallback(async () => {
    if (!client) return;
    try {
      const result = await client.archiveWorkspace(chat.workspaceId);
      if (result.error) throw new Error(result.error);
    } catch (error) {
      toast.show(error instanceof Error ? error.message : "Could not archive chat.", {
        variant: "error",
      });
    }
  }, [chat, client, toast]);
  const selected = active?.serverId === chat.serverId && active.workspaceId === chat.workspaceId;
  return (
    <>
      <View style={[styles.chat, nested && styles.nested, selected && styles.selected]}>
        <Pressable
          style={styles.chatTitleButton}
          accessibilityRole="button"
          accessibilityLabel={chat.title}
          testID={`company-chat-${chat.workspaceId}`}
          onPress={open}
        >
          <Text numberOfLines={1} style={styles.chatTitle}>
            {chat.title}
          </Text>
          {chat.busy ? <View style={styles.busy} accessibilityLabel="Thinking" /> : null}
        </Pressable>
        <DropdownMenu>
          <DropdownMenuTrigger
            style={styles.smallButton}
            accessibilityLabel={`Options for ${chat.title}`}
            testID={`company-chat-options-${chat.workspaceId}`}
          >
            <MoreIcon size={17} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" minWidth={180}>
            <DropdownMenuItem onSelect={rename}>Rename</DropdownMenuItem>
            <DropdownMenuItem onSelect={pin}>{chat.pinned ? "Unpin" : "Pin"}</DropdownMenuItem>
            <DropdownMenuItem onSelect={move}>Move to project</DropdownMenuItem>
            <DropdownMenuItem onSelect={archive}>Archive</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </View>
      {sheet ? (
        <ChatSheet mode={sheet} chat={chat} projects={projects} onClose={closeSheet} />
      ) : null}
    </>
  );
}

function ChatSheet({ mode, chat, projects, onClose }: ChatSheetProps) {
  const client = useHostRuntimeClient(chat.serverId);
  const [title, setTitle] = useState(chat.title);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const header = useMemo(
    () => ({ title: mode === "rename" ? "Rename chat" : "Move chat" }),
    [mode],
  );
  const save = useCallback(async () => {
    if (!client || busy || !title.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await client.setWorkspaceTitle(chat.workspaceId, title.trim());
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not rename chat.");
    } finally {
      setBusy(false);
    }
  }, [client, busy, title, chat.workspaceId, onClose]);
  const moveTo = useCallback(
    async (projectId?: string) => {
      if (!client || busy) return;
      setBusy(true);
      setError(null);
      try {
        const result = await client.moveCompanyChat(chat.workspaceId, projectId);
        if (result.error || !result.workspace || !result.project)
          throw new Error(result.error || "Could not move chat.");
        useSessionStore
          .getState()
          .upsertProject(chat.serverId, normalizeProjectDescriptor(result.project));
        getHostRuntimeStore().acceptWorkspaceSnapshots(chat.serverId, [
          normalizeWorkspaceDescriptor(result.workspace),
        ]);
        onClose();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not move chat.");
      } finally {
        setBusy(false);
      }
    },
    [client, busy, chat, onClose],
  );
  const moveOutside = useCallback(() => moveTo(), [moveTo]);
  const footer = useMemo(
    () => (
      <View style={styles.actions}>
        <Button variant="ghost" disabled={busy} onPress={onClose}>
          Cancel
        </Button>
        {mode === "rename" ? (
          <Button disabled={busy || !title.trim()} loading={busy} onPress={save}>
            Save
          </Button>
        ) : null}
      </View>
    ),
    [busy, onClose, mode, title, save],
  );
  return (
    <AdaptiveModalSheet
      visible
      header={header}
      onClose={onClose}
      footer={footer}
      testID="company-chat-options-dialog"
    >
      {mode === "rename" ? (
        <Field label="Chat name" error={error}>
          <FormTextInput
            autoFocus
            initialValue={chat.title}
            onChangeText={setTitle}
            accessibilityLabel="Chat name"
            maxLength={160}
            onSubmitEditing={save}
          />
        </Field>
      ) : (
        <MoveTargets
          chat={chat}
          projects={projects}
          busy={busy}
          error={error}
          onMove={moveTo}
          onMoveOutside={moveOutside}
        />
      )}
    </AdaptiveModalSheet>
  );
}
interface MoveTargetsProps {
  chat: CompanyChatRow;
  projects: CompanyProjectRow[];
  busy: boolean;
  error: string | null;
  onMove: (projectId: string) => Promise<void>;
  onMoveOutside: () => Promise<void>;
}
function MoveTargets({ chat, projects, busy, error, onMove, onMoveOutside }: MoveTargetsProps) {
  return (
    <View>
      <Button variant="ghost" disabled={busy} onPress={onMoveOutside}>
        Outside projects
      </Button>
      {projects
        .filter(
          (project) => project.serverId === chat.serverId && project.projectId !== chat.projectId,
        )
        .map((project) => (
          <ProjectMoveButton key={project.key} project={project} disabled={busy} onMove={onMove} />
        ))}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}
interface ProjectMoveButtonProps {
  project: CompanyProjectRow;
  disabled: boolean;
  onMove: (projectId: string) => Promise<void>;
}
function ProjectMoveButton({ project, disabled, onMove }: ProjectMoveButtonProps) {
  const move = useCallback(() => onMove(project.projectId), [onMove, project.projectId]);
  return (
    <Button variant="ghost" disabled={disabled} onPress={move}>
      {project.name}
    </Button>
  );
}

const styles = StyleSheet.create((theme) => ({
  list: { flex: 1, minHeight: 0 },
  content: { paddingHorizontal: 10, paddingBottom: 20 },
  heading: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    paddingLeft: 12,
    paddingRight: 4,
    marginTop: 20,
    marginBottom: 6,
    minHeight: 22,
  },
  headingText: { fontSize: 12, fontWeight: "500", color: theme.colors.foregroundMuted },
  grow: { flex: 1 },
  empty: {
    fontSize: 13,
    lineHeight: 19,
    color: theme.colors.foregroundMuted,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chat: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 37,
    borderRadius: 10,
    marginVertical: 1,
    paddingLeft: 12,
    paddingRight: 4,
  },
  nested: { paddingLeft: 10 },
  selected: { backgroundColor: theme.colors.surfaceSidebarHover },
  chatTitleButton: {
    flex: 1,
    minWidth: 0,
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  chatTitle: { fontSize: 14, color: theme.colors.foreground, flex: 1 },
  smallButton: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 7,
  },
  busy: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.accent },
  projectRow: { flexDirection: "row", alignItems: "center", minHeight: 39, paddingRight: 4 },
  projectMain: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingVertical: 8,
  },
  projectName: { flex: 1, fontSize: 14, color: theme.colors.foreground, fontWeight: "500" },
  projectChats: { marginLeft: 27 },
  newProjectChat: { alignSelf: "flex-start" },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: theme.spacing[2] },
  error: { color: theme.colors.accent, fontSize: 13, padding: 12 },
}));
