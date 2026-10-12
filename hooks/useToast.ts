import toast from 'react-hot-toast';

export const useToast = () => {
    const showSuccess = (message: string) => {
        toast.success(message);
    };

    const showError = (message: string) => {
        toast.error(message);
    };

    const showInfo = (message: string) => {
        toast(message);
    };

    return { showSuccess, showError, showInfo };
};
