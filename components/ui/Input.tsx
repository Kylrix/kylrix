import { forwardRef } from "react";
import { TextField, TextFieldProps, alpha, styled } from "@mui/material";

export type InputProps = TextFieldProps;

const StyledTextField = styled(TextField)(({ theme }) => ({
  '& .MuiOutlinedInput-root': {
    borderRadius: '12px',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    transition: 'all 0.2s ease',
    '& fieldset': {
      borderColor: 'rgba(255, 255, 255, 0.1)',
      borderWidth: '1px',
    },
    '&:hover fieldset': {
      borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    '&.Mui-focused fieldset': {
      borderColor: theme.palette.primary.main,
      borderWidth: '1px',
    },
    '&.Mui-focused': {
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      boxShadow: `0 0 0 4px ${alpha(theme.palette.primary.main, 0.1)}`,
    },
  },
  '& .MuiInputBase-input': {
    padding: '12px 16px',
    fontSize: '0.95rem',
    '&::placeholder': {
      color: theme.palette.text.disabled,
      opacity: 1,
    },
  },
}));

const Input = forwardRef<HTMLDivElement, InputProps>(
  (props, ref) => {
    return (
      <StyledTextField
        fullWidth
        variant="outlined"
        ref={ref}
        {...props}
      />
    );
  },
);

Input.displayName = "Input";

export { Input };
