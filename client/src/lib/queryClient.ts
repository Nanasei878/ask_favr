import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  // Get user ID for proper identification
  const storedUser = localStorage.getItem('favr_user');
  const headers: Record<string, string> = data ? { "Content-Type": "application/json" } : {};
  
  if (storedUser) {
    try {
      const user = JSON.parse(storedUser);
      headers['user-id'] = user.id?.toString() || '1';
    } catch (error) {
      console.error('Error parsing stored user:', error);
    }
  }

  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Get user ID for proper identification in GET requests
    const storedUser = localStorage.getItem('favr_user');
    const headers: Record<string, string> = {};
    
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        headers['user-id'] = user.id?.toString() || '1';
      } catch (error) {
        console.error('Error parsing stored user:', error);
      }
    }

    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
      headers,
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      staleTime: 0, // Make queries immediately stale to force fresh data
      refetchOnWindowFocus: true, // Refetch when window gains focus
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
