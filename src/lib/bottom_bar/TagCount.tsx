import React, {useEffect, useState} from 'react';
import {ITag} from '../db/types';
import {Typography} from '@mui/material';
import {db} from '../db/db';
import {observer} from 'mobx-react';
import {useParams} from 'react-router-dom';

const TagCount = () => {
  const {user} = useParams();
  const [tags, setTags] = useState<ITag[]>([]);

  useEffect(() => {
    if (user !== undefined) {
      db.getTagsForUserName(user).then(result => setTags(result));
    }
  }, []);

  return (
    <Typography
      variant="caption"
      fontFamily="monospace"
      sx={{
        mr: theme => theme.spacing(0.5),
      }}
    >
      [tags: {tags.length}]
    </Typography>
  );
};
export default React.memo(observer(TagCount));
