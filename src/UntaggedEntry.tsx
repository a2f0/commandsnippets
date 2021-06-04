import React, {useMemo, useState} from 'react';
import API from './api';
import {AxiosError} from 'axios';
import DragIndicatorIcon from '@material-ui/icons/DragIndicator';
import {IMouse} from './Entry';
import {ITextEntry} from './Entry';
import ItemTypes from './ItemTypes';
import UntaggedEntryContextMenu from './UntaggedEntryContextMenu';
import {makeStyles} from '@material-ui/core/styles';
import {observer} from 'mobx-react';
import {useDrag} from 'react-dnd';

// const style = {
//   border: '1px dashed gray',
//   backgroundColor: 'white',
//   padding: '0.5rem 1rem',
//   marginRight: '1.5rem',
//   marginBottom: '1.5rem',
//   cursor: 'move',
//   float: 'left',
// }

const useStyles = makeStyles({
  entry: {
    display: 'inline-block',
    verticalAlign: 'top',
  },
  entryWrapper: {
    marginBottom: 16,
  },
  entrySubject: {},
  entryBody: {
    fontSize: 14,
    fontFamily: 'monospace',
    whiteSpace: 'pre-wrap',
  },
  dragIndicator: {
    display: 'inline-block',
    width: '15px',
  },
});

interface IUntaggedEntryProps {
  id: number;
  key: number;
  entry: ITextEntry;
  retrieveEntries: () => void;
}

const UntaggedEntry = React.memo(
  observer((props: IUntaggedEntryProps) => {
    const [showDragHandle, setShowDragHandle] = useState(false);
    const classes = useStyles();

    const mouseEnter = () => {
      setShowDragHandle(true);
    };
    const mouseLeave = () => {
      setShowDragHandle(false);
    };

    const [{isDragging}, drag] = useDrag({
      item: () => ({type: ItemTypes.UNTAGGEDENTRY}),
      type: ItemTypes.UNTAGGEDENTRY,
      end: (item, monitor) => {
        const dropResult: ITextEntry | null = monitor.getDropResult();
        if (item && dropResult) {
          console.info('it was dropped');
          if ('type' in dropResult) {
            if (dropResult.type === 'Tag') {
              console.info(props.entry.id);
              const payload = {
                data: {
                  type: 'TagTextEntryThroughModel',
                  attributes: {},
                  relationships: {
                    tag: {
                      data: {
                        type: 'Tag',
                        id: dropResult.id,
                      },
                    },
                    text_entry: {
                      data: {
                        type: 'TextEntry',
                        id: props.entry.id,
                      },
                    },
                  },
                },
              };
              API.post('tags_entries', payload, {withCredentials: true})
                .then(() => {
                  props.retrieveEntries();
                })
                .catch((error: AxiosError) => {
                  // handle error
                  console.log(error);
                })
                .then(() => {
                  // always executed
                });
            }
          }
        }
      },
      collect: monitor => ({
        isDragging: monitor.isDragging(),
      }),
    });
    const opacity = isDragging ? 0 : 1;

    const initialMouse: IMouse = {
      mouseX: null,
      mouseY: null,
    };

    const [mouse, setMouse] = useState(initialMouse);

    const handleContextClick = (event: React.MouseEvent<HTMLDivElement>) => {
      console.info('context click');
      event.preventDefault();
      event.stopPropagation();
      const mouseData = {...mouse};
      (mouseData.mouseX = event.clientX - 2),
        (mouseData.mouseY = event.clientY - 4),
        setMouse(mouseData);
    };

    const handleDelete = () => {
      API.delete('/entries/' + props.entry.id, {withCredentials: true})
        .then(() => {
          props.retrieveEntries();
        })
        .catch((error: AxiosError) => {
          // handle error
          console.log(error);
        })
        .then(() => {
          // always executed
        });
    };

    const contextMenu = useMemo(
      () => (
        <UntaggedEntryContextMenu mouse={mouse} handleDelete={handleDelete} />
      ),
      [mouse]
    );

    return (
      <>
        <div
          className={classes.entryWrapper}
          onContextMenu={handleContextClick}
          ref={drag}
          style={{opacity}}
        >
          <div
            className={classes.dragIndicator}
            onMouseEnter={mouseEnter}
            onMouseLeave={mouseLeave}
          >
            <DragIndicatorIcon
              style={{visibility: showDragHandle ? 'visible' : 'hidden'}}
            />
          </div>
          <div
            className={classes.entry}
            onMouseEnter={mouseEnter}
            onMouseLeave={mouseLeave}
          >
            <div className={classes.entrySubject}>
              {props.entry.attributes.subject}
            </div>
            <div className={classes.entryBody}>
              {props.entry.attributes.body}
            </div>
          </div>
        </div>
        <>{contextMenu}</>
      </>
    );
  })
);
export default UntaggedEntry;
