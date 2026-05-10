import { AuthService } from './auth.service';
import { LoginDto, ChangePasswordDto } from './dto/login.dto';
export declare class AuthController {
    private auth;
    constructor(auth: AuthService);
    login(dto: LoginDto, res: any): Promise<{
        success: boolean;
        data: {
            expiresIn: number;
        };
    }>;
    logout(res: any): {
        success: boolean;
    };
    getMe(user: any): {
        success: boolean;
        data: any;
    };
    changePassword(user: any, dto: ChangePasswordDto): Promise<{
        success: boolean;
        data: {
            message: string;
        };
    }>;
}
