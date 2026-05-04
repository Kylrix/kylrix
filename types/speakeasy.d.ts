declare module 'speakeasy' {
    export interface TotpOptions {
        secret: string;
        encoding?: 'ascii' | 'base32' | 'base64' | 'hex';
        token?: string;
        step?: number;
        window?: number;
        time?: number;
        epoch?: number;
        counter?: number;
        digits?: number;
        algorithm?: 'sha1' | 'sha256' | 'sha512';
    }

    export function totp(options: TotpOptions): string;
    
    export namespace totp {
        export function verify(options: TotpOptions & { token: string }): boolean;
    }

    export interface GeneratedSecret {
        ascii: string;
        hex: string;
        base32: string;
        otpauth_url?: string;
        google_auth_qr?: string;
    }

    export interface GenerateSecretOptions {
        length?: number;
        name?: string;
        issuer?: string;
        otpauth_url?: boolean;
        symbols?: boolean;
        google_auth_qr?: boolean;
        qr_codes?: boolean;
        encoding?: 'ascii' | 'base32' | 'base64' | 'hex';
    }

    export function generateSecret(options?: GenerateSecretOptions): GeneratedSecret;
}
