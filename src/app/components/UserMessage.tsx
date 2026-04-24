import { info2 } from '../../../public/icons';
import { Icon } from './Icon';

type UserMessageProps = {
  title?: string;
  message?: string;
};

const UserMessage = ({
  title = 'Platstjänster avslaget.',
  message = 'Aktivera platstjänster för full funktionallitet.',
}: UserMessageProps) => {
  return (
    <>
      <article className='warn-message'>
        <div className='warn-message-title'>
          <Icon
            path={info2.path}
            iconSize='20px'
            fill='black'
            title='info'
            className='no-position-icon'
          />
          <p>
            <strong>{title}</strong>
          </p>
        </div>
        <p>{message}</p>
      </article>
    </>
  );
};
export default UserMessage;
