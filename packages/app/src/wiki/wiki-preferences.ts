import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

export function useWikiFavorites(serverId: string) {
  const key = `optimize.wiki.favorites.${serverId}`;
  const [ids, setIds] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(key)
      .then((raw) => {
        const value: unknown = raw ? JSON.parse(raw) : [];
        if (active && Array.isArray(value))
          setIds(value.filter((entry): entry is string => typeof entry === "string"));
        return undefined;
      })
      .catch(() => {
        if (active) setError("Favorites could not be loaded on this device.");
      })
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [key]);
  useEffect(() => {
    if (!loaded || error) return;
    void AsyncStorage.setItem(key, JSON.stringify(ids)).catch(() =>
      setError("Favorites could not be saved on this device."),
    );
  }, [loaded, error, key, ids]);
  const toggle = useCallback(
    (id: string) =>
      setIds((current) =>
        current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id],
      ),
    [],
  );
  return { ids, loaded, toggle, error };
}
