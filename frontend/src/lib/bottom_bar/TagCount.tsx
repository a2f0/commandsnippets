import {Typography} from '@mui/material';
import {observer} from 'mobx-react';
import React, {useEffect, useState} from 'react';
import {useParams} from 'react-router-dom';

import {db} from '../db/db';
import type {ITag} from '../db/types';

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
        color: theme => theme.palette.text.primary,
      }}
    >
      [tags: {tags.length}]
    </Typography>
  );
};

export const MemoizedTagCount = React.memo(observer(TagCount));
