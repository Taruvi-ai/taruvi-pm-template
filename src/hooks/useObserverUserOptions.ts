import { useDataProvider, useList } from "@refinedev/core";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  dedupeUsers,
  filterUsersByAllTokens,
  searchableTokens,
  tokenizeName,
} from "../utils/userSearch";

// Mirrors the label shown in the observer dropdown so the client-side ordering
// matches what the user actually reads.
const getUserSortKey = (user: any) => {
  const firstName = String(user?.first_name || "").trim();
  const lastName = String(user?.last_name || "").trim();
  const name = `${firstName} ${lastName}`.trim();
  return (
    name ||
    String(user?.full_name || user?.username || user?.email || user?.id || "")
  ).toLowerCase();
};

const sortUsersByName = (users: any[]) =>
  [...users].sort((a, b) => getUserSortKey(a).localeCompare(getUserSortKey(b)));

type UseObserverUserOptionsParams = {
  searchText: string;
  selectedUserIds: string[];
  initialUsers?: any[];
  loadDefaultUsers?: boolean;
};

export const useObserverUserOptions = ({
  searchText,
  selectedUserIds,
  initialUsers = [],
  loadDefaultUsers = true,
}: UseObserverUserOptionsParams) => {
  const dataProvider = useDataProvider();
  const trimmedSearch = String(searchText || "").trim();
  const selectedIdStrings = useMemo(
    () =>
      selectedUserIds
        .map((id) => String(id).trim())
        .filter((id) => id.length > 0),
    [selectedUserIds]
  );
  const selectedIdSet = useMemo(() => new Set(selectedIdStrings), [selectedIdStrings]);
  const userCacheRef = useRef<Record<string, any>>({});
  const attemptedSelectedFetchIdsRef = useRef<Set<string>>(new Set());
  const [resolvedSelectedUsersById, setResolvedSelectedUsersById] = useState<Record<string, any>>({});
  const [isResolvingSelectedUsers, setIsResolvingSelectedUsers] = useState(false);

  const shouldLoadDefaultUsers = loadDefaultUsers && trimmedSearch.length === 0;
  const shouldSearchUsers = trimmedSearch.length > 0;

  // The user provider forwards sorters to the API as `ordering`, and the users
  // endpoint rejects `first_name` / `last_name` with a 400 ("Unsupported
  // ordering"). Fetch unsorted and order the options client-side instead.
  const { result: defaultUsersResult, query: defaultUsersQuery } = useList({
    resource: "users",
    dataProviderName: "user",
    pagination: { currentPage: 1, pageSize: 50, mode: "server" },
    queryOptions: { enabled: shouldLoadDefaultUsers },
  });

  const { result: searchedUsersResult, query: searchedUsersQuery } = useList({
    resource: "users",
    dataProviderName: "user",
    filters:
      trimmedSearch.length > 0
        ? [{ field: "search", operator: "eq", value: trimmedSearch }]
        : [],
    pagination: { currentPage: 1, pageSize: 100, mode: "server" },
    queryOptions: { enabled: shouldSearchUsers },
  });

  // The users endpoint matches one term against one column, so a "First Last"
  // query returns nothing even when that person exists. Search the first and
  // last words in parallel as well, then keep whoever matches every word.
  const searchTokens = useMemo(() => tokenizeName(trimmedSearch), [trimmedSearch]);
  const tokenQueries = useMemo(() => searchableTokens(searchTokens), [searchTokens]);
  const isMultiWordSearch = tokenQueries.length > 1;

  const { result: firstTokenResult, query: firstTokenQuery } = useList({
    resource: "users",
    dataProviderName: "user",
    filters: isMultiWordSearch
      ? [{ field: "search", operator: "eq", value: tokenQueries[0] }]
      : [],
    pagination: { currentPage: 1, pageSize: 100, mode: "server" },
    queryOptions: { enabled: shouldSearchUsers && isMultiWordSearch },
  });

  const { result: lastTokenResult, query: lastTokenQuery } = useList({
    resource: "users",
    dataProviderName: "user",
    filters: isMultiWordSearch
      ? [{ field: "search", operator: "eq", value: tokenQueries[1] }]
      : [],
    pagination: { currentPage: 1, pageSize: 100, mode: "server" },
    queryOptions: { enabled: shouldSearchUsers && isMultiWordSearch },
  });

  /**
   * What the search actually found. The whole-string result wins when it has
   * hits; otherwise fall back to the per-word union, narrowed to people who
   * match every word.
   */
  const searchedUsers = useMemo(() => {
    const whole = searchedUsersResult?.data || [];
    if (whole.length > 0 || !isMultiWordSearch) return whole;
    const union = dedupeUsers(firstTokenResult?.data, lastTokenResult?.data);
    return filterUsersByAllTokens(union, trimmedSearch);
  }, [
    searchedUsersResult?.data,
    firstTokenResult?.data,
    lastTokenResult?.data,
    isMultiWordSearch,
    trimmedSearch,
  ]);

  const availableSelectedIds = useMemo(() => {
    const ids = new Set<string>();
    [...initialUsers, ...(defaultUsersResult?.data || []), ...searchedUsers].forEach(
      (user: any) => {
        if (!user || user.id === null || user.id === undefined) return;
        ids.add(String(user.id));
      }
    );
    Object.keys(resolvedSelectedUsersById).forEach((id) => ids.add(String(id)));
    return ids;
  }, [initialUsers, defaultUsersResult?.data, searchedUsers, resolvedSelectedUsersById]);

  const missingSelectedIds = useMemo(
    () =>
      selectedIdStrings.filter(
        (id) => !availableSelectedIds.has(id) && !attemptedSelectedFetchIdsRef.current.has(id)
      ),
    [selectedIdStrings, availableSelectedIds]
  );

  useEffect(() => {
    if (missingSelectedIds.length === 0) return;
    let cancelled = false;

    missingSelectedIds.forEach((id) => attemptedSelectedFetchIdsRef.current.add(id));
    setIsResolvingSelectedUsers(true);

    const fetchMissingSelectedUsers = async () => {
      const entries = await Promise.all(
        missingSelectedIds.map(async (id) => {
          try {
            const response = await dataProvider("user").getOne({
              resource: "users",
              id,
            });
            const resolvedUser = (response as any)?.data ?? null;
            if (!resolvedUser || resolvedUser.id === null || resolvedUser.id === undefined) return null;
            return [String(resolvedUser.id), resolvedUser] as const;
          } catch {
            return null;
          }
        })
      );

      if (cancelled) return;

      const nextResolved: Record<string, any> = {};
      entries.forEach((entry) => {
        if (!entry) return;
        nextResolved[entry[0]] = entry[1];
      });

      if (Object.keys(nextResolved).length > 0) {
        setResolvedSelectedUsersById((prev) => ({ ...prev, ...nextResolved }));
      }

      setIsResolvingSelectedUsers(false);
    };

    void fetchMissingSelectedUsers();

    return () => {
      cancelled = true;
    };
  }, [missingSelectedIds, dataProvider]);

  useEffect(() => {
    const users = [
      ...initialUsers,
      ...Object.values(resolvedSelectedUsersById),
      ...(defaultUsersResult?.data || []),
      ...searchedUsers,
    ];

    users.forEach((user: any) => {
      if (!user || user.id === null || user.id === undefined) return;
      userCacheRef.current[String(user.id)] = user;
    });
  }, [initialUsers, resolvedSelectedUsersById, defaultUsersResult?.data, searchedUsers]);

  const options = useMemo(() => {
    const fromInitial = trimmedSearch.length === 0 ? initialUsers : [];
    const fromDefault = trimmedSearch.length === 0 ? defaultUsersResult?.data || [] : [];
    const fromSearch = trimmedSearch.length > 0 ? searchedUsers : [];
    const baseUsers =
      trimmedSearch.length > 0
        ? fromSearch
        : [...fromInitial, ...Object.values(resolvedSelectedUsersById), ...fromDefault];

    // Look selected ids up in this render's data, not just the cache: the cache
    // is filled by an effect, so on the render where a user first arrives (e.g.
    // bulk import seeding a matched assignee) it is still empty. Falling through
    // to the placeholder there would also win the dedupe below and stick, since
    // a ref update never recomputes this memo.
    const knownById = new Map<string, any>();
    [
      ...Object.values(userCacheRef.current),
      ...initialUsers,
      ...Object.values(resolvedSelectedUsersById),
      ...(defaultUsersResult?.data || []),
      ...searchedUsers,
    ].forEach((user: any) => {
      if (!user || user.id === null || user.id === undefined) return;
      knownById.set(String(user.id), user);
    });

    const selectedUsers = selectedIdStrings.map((id) => {
      const known = knownById.get(id);
      if (known) return known;
      const numericId = Number(id);
      return {
        id: Number.isFinite(numericId) ? numericId : id,
        username: `User ${id}`,
      };
    });

    const merged = [...selectedUsers, ...baseUsers];
    const seen = new Set<string>();
    const unique: any[] = [];

    merged.forEach((user: any) => {
      if (!user || user.id === null || user.id === undefined) return;
      const key = String(user.id);
      if (seen.has(key)) return;
      seen.add(key);
      unique.push(user);
    });

    const selectedById = new Map(
      unique
        .filter((user: any) => selectedIdSet.has(String(user.id)))
        .map((user: any) => [String(user.id), user])
    );

    const orderedSelected = selectedIdStrings
      .map((id) => selectedById.get(id))
      .filter(Boolean) as any[];

    const nonSelected = sortUsersByName(
      unique.filter((user: any) => !selectedIdSet.has(String(user.id)))
    );

    return [...orderedSelected, ...nonSelected];
  }, [
    initialUsers,
    resolvedSelectedUsersById,
    trimmedSearch,
    selectedIdStrings,
    selectedIdSet,
    defaultUsersResult?.data,
    searchedUsers,
  ]);

  const isLoading =
    (shouldLoadDefaultUsers && !!defaultUsersQuery.isLoading) ||
    (shouldSearchUsers && !!searchedUsersQuery.isLoading) ||
    (shouldSearchUsers && isMultiWordSearch && !!firstTokenQuery.isLoading) ||
    (shouldSearchUsers && isMultiWordSearch && !!lastTokenQuery.isLoading) ||
    isResolvingSelectedUsers;

  return {
    options,
    isLoading,
  };
};
