
import { Schema, model, Types } from 'mongoose';
import { IUserDTO } from '../dto/User.dto';

export interface IUser extends IUserDTO {
  _id?: Types.ObjectId;
}

const UserSchema = new Schema<IUser>({
  name: { type: String, maxlength: 255 },
  email: { type: String, maxlength: 255 }
});

export const User = model<IUser>('User', UserSchema);
