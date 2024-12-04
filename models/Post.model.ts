
import { Schema, model, Types } from 'mongoose';
import { IPostDTO } from '../dto/Post.dto';

export interface IPost extends IPostDTO {
  _id?: Types.ObjectId;
}

const PostSchema = new Schema<IPost>({
  title: { type: String, maxlength: 255 },
  content: { type: String, maxlength: 255 },
  author: [{ type: Schema.Types.ObjectId, ref: 'User' }]
});

export const Post = model<IPost>('Post', PostSchema);
