import { Link } from 'react-router-dom';
import { Dots } from 'shared/icons/index';
import classes from './style.module.css';

export default function ProfileMenu() {
  return (
    <div className={classes.profile_menu_wrap}>
      <div className={classes.profile_menu}>
        <Link to="#" className={classes.active}>
          Bài viết
        </Link>
        <Link to="#" className="hover1">
          Giới thiệu
        </Link>
        <Link to="#" className="hover1">
          Bạn bè
        </Link>
        <Link to="#" className="hover1">
          Ảnh
        </Link>
      </div>
      <div className={classes.more}>
        <Dots />
      </div>
    </div>
  );
}
