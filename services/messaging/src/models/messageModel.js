const mongoose = require('mongoose');
const Chat = require('./chatModel');
const validator = require('validator');
const User = require('./userModel');

const messageSchema = mongoose.Schema(
  {
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    type: {
      type: String,
      enum: ['text', 'image', 'like', 'info'],
      required: [true, 'message type is required'],
    },
    content: {
      type: String,
      trim: true,
      validate: {
        validator: function (val) {
          if (this.type === 'like') return true;
          return validator.isLength(val, { min: 1, max: 400 });
        },
        message: 'Message must have a content at least 1 charcters ',
      },
    },
    chat: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat' },
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

// The badge counts conversations whose latest message this user has not read.
messageSchema.statics.recalculateUnread = async function (userIds) {
  return Promise.all(
    userIds.map(async (id) => {
      const userId = new mongoose.Types.ObjectId(id);
      const result = await Chat.aggregate([
        { $match: { users: userId } },
        {
          $lookup: {
            from: 'messages',
            localField: 'latestMessage',
            foreignField: '_id',
            as: 'latestMessage',
          },
        },
        { $unwind: '$latestMessage' },
        {
          $match: {
            'latestMessage.sender': { $ne: userId },
            'latestMessage.seenBy': { $ne: userId },
          },
        },
        { $count: 'count' },
      ]);
      const count = result[0]?.count || 0;
      await User.updateOne({ _id: userId }, { $set: { unseenMessages: count } });
      return count;
    })
  );
};

messageSchema.pre('save', function () {
  this.$locals.wasNew = this.isNew;
});

messageSchema.post('save', async function () {
  // Updating a read receipt must never move the conversation back to an older message.
  if (this.$locals.wasNew) {
    await Chat.updateOne({ _id: this.chat }, { $set: { latestMessage: this._id } });
    const chat = await Chat.findById(this.chat);
    if (chat) await this.constructor.recalculateUnread(chat.users.map((user) => user._id));
  }
  await this.populate({
    path: 'sender',
    select: 'first_name last_name photo username confirmed',
  });
});

const Message = mongoose.model('Message', messageSchema);
module.exports = Message;
