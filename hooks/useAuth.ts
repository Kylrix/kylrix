import { useAppwriteVault } from '@/context/appwrite-context';

export const useAuth = () => {
    const { user, loading, isAuthenticated, openIDMWindow, logout } = useAppwriteVault();

    return {
        user,
        isLoading: loading,
        isAuthenticated,
        login: openIDMWindow,
        logout
    };
};
