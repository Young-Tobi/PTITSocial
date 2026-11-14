const mongoose = require('mongoose');
const Chat = require('./chatModel');
const validator = require('validator');
const User = require('./userModel');

const messageSchema = mongoose.Schema(
  {
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    type: {
      type: String,
      enum: ['text', 'image', 'file', 'like', 'info'],
      required: [true, 'Vui lòng chọn loại tin nhắn'],
    },
    content: {
      type: String,
      trim: true,
      validate: {
        validator: function (val) {
          if (this.type === 'like') return true;
          return validator.isLength(val, { min: 1, max: 400 });
        },
        message: 'Tin nhắn phải có từ 1 đến 400 ký tự ',
      },
    },
    chat: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat' },
    imageFile: { type: String, select: false },
    attachmentFile: { type: String, select: false },
    attachment: { name: String, size: Number, mimeType: String },
    caption: { type: String, trim: true, maxlength: [400, 'Chú thích không được quá 400 ký tự'] },
    replyTo: {
      type: new mongoose.Schema(
        {
          messageId: { type: mongoose.Schema.Types.ObjectId, required: true },
          sender: {
            id: mongoose.Schema.Types.ObjectId,
            first_name: String,
            last_name: String,
          },
          type: { type: String, enum: ['text', 'image', 'file', 'like'] },
          content: String,
          attachmentName: String,
        },
        { _id: false }
      ),
      default: undefined,
    },
    forwarded: { type: Boolean, default: false },
    seen: {
      type: String,
      enum: ['seen', 'unseen'],
      default: 'unseen',
    },
    seenBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

messageSchema.pre(/^find/, async function (next) {
  this.populate({
    path: 'sender',
    select: 'first_name last_name photo username confirmed',
  });
  next();
});

messageSchema.statics.updateLatestMessage = async function (chatId, messageId, th) {
  const existingeGroupChat = await Chat.findById(chatId);
  existingeGroupChat.latestMessage = messageId;
  await existingeGroupChat.save();

  const userId = existingeGroupChat.users.filter((user) => {
    return user._id.toString() !== th.sender._id.toString();
  });

  const result = await Chat.aggregate([
    {
      $match: {
        users: {
          $elemMatch: {
            $eq: mongoose.Types.ObjectId(userId[0]),
          },
        },
      },
    },
    {
      $lookup: {
        from: 'messages',
        localField: 'latestMessage',
        foreignField: '_id',
        as: 'latestMessage',
      },
    },
    {
      $unwind: '$latestMessage',
    },
    {
      $match: {
        'latestMessage.seen': 'unseen',
      },
    },
    {
      $match: {
        'latestMessage.sender': {
          $ne: mongoose.Types.ObjectId(userId[0]),
        },
      },
    },
    {
      $count: 'count',
    },
  ]);

  await User.findByIdAndUpdate(userId[0], {
    unseenMessages: result[0]?.count || 0,
  });
};

messageSchema.post('save', async function () {
  // this points to current review
  this.populate({
    path: 'sender',
    select: 'first_name last_name photo username confirmed',
  });
  await this.constructor.updateLatestMessage(this.chat, this._id, this);
});

const Message = mongoose.model('Message', messageSchema);
module.exports = Message;
