
import { Types } from "mongoose";

export interface IPostDTO {
  title: string;
  content: string;
  author: Types.ObjectId;
}
