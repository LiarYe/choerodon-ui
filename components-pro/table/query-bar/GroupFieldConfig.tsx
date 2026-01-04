import React, { FunctionComponent, useMemo, useState, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { observer } from 'mobx-react-lite';
import Icon from 'choerodon-ui/lib/icon';
import Popover from 'choerodon-ui/lib/popover';
import { FieldType } from 'choerodon-ui/pro/lib/data-set/enum';
import Tag from 'choerodon-ui/lib/tag';
import DataSet from '../../data-set/DataSet';
import Record from '../../data-set/Record';
import TableStore from '../TableStore';
import { GroupType } from '../enum';
import Button from '../../button';
import { FuncType, ButtonColor } from '../../button/interface';
import Select from '../../select';
import { $l } from '../../locale-context';

const { Option } = Select;

interface GroupFieldConfigProps {
  tableStore: TableStore,
  dataSet: DataSet,
  prefixCls?: string,
}

const emptyArray = [];

const GroupFieldConfig: FunctionComponent<GroupFieldConfigProps> = function GroupFieldConfig(props) {
  const { tableStore, dataSet, prefixCls } = props;
  const {
    groups = emptyArray,
    initGroups,
  } = tableStore;
  const { fields } = dataSet;
  const groupPrefixCls = `${prefixCls}-group-config`;
  const [visible, setVisible] = useState<boolean>(false);

  const groupFieldOptions = useMemo<DataSet>(() => {
    const groupFieldData: any[] = [];
    if (fields && fields.size) {
      fields.forEach(field => {
        groupFieldData.push({
          value: field.name,
          meaning: field.get('label') || field.name,
        });
      });
    }
    return new DataSet({
      autoQuery: false,
      autoCreate: false,
      paging: false,
      fields: [
        { name: 'value', type: FieldType.string },
        { name: 'meaning', type: FieldType.string },
      ],
      data: groupFieldData,
    });
  }, [fields]);

  const groupDS = useMemo<DataSet>(() => {
    const data: any[] = [];
    groups.forEach((group) => {
      const record = groupFieldOptions.find(record => record.get('value') === group.name);
      if (record) {
        data.push({
          groupName: group.name,
          groupType: group.type || GroupType.column,
        });
      }
    });
    return new DataSet({
      forceValidate: true,
      autoQuery: false,
      autoCreate: true,
      paging: false,
      fields: [
        { name: 'groupName', type: FieldType.string, options: groupFieldOptions },
        { name: 'groupType', type: FieldType.string, defaultValue: GroupType.column },
      ],
      data,
    });
  }, [groupFieldOptions, dataSet, groups, visible]);

  const optionsFilter = (record: Record) => {
    return groupDS.every(groupRecord => groupRecord.get('groupName') !== record.get('value'));
  };

  const onVisibleChange = (visible: boolean) => {
    if (!visible) {
      groupDS.reset();
    }
    setVisible(visible);
  }

  const handleCancel = () => {
    groupDS.reset();
    setVisible(false);
  }

  const handleConfirm = () => {
    groupDS.validate().then(result => {
      if (result) {
        const records = groupDS.filter(r => r.get('groupName') && r.get('groupType'));
        const newGroups = records.map(record => {
          const group = groups.find(group => group.name === record.get('groupName') && group.type === record.get('groupType'));
          return {
            ...group,
            name: record.get('groupName'),
            type: record.get('groupType'),
          };
        });
        // TODO: 组装 groups, 传参
        initGroups(newGroups);
        setVisible(false);
      }
    });
  }

  const onDragEnd = useCallback((result: DropResult) => {
    if (result.destination) {
      groupDS.move(result.source.index, result.destination.index);
    }
  }, [groupDS, groupDS.data]);

  const GroupDragItem: FunctionComponent<{record: Record, index: number}> = ({record, index}) => {
    const { key } = record;
    return (
      <Draggable
        draggableId={String(key)}
        index={record.index}
      >
        {(pro, snapshot) => (
          <span
            ref={pro.innerRef}
            {...pro.draggableProps}
            className={`${groupPrefixCls}-list-item${snapshot.isDragging ? ` ${groupPrefixCls}-list-item-dragging` : ''}`}
          >
            <span {...pro.dragHandleProps} className={`${groupPrefixCls}-list-item-drag`}>
              <Icon type="baseline-drag_indicator" />
            </span>
            <span className={`${groupPrefixCls}-list-item-index`}>
              <Tag>{index + 1}</Tag>
            </span>
            <Select
              placeholder={$l('Table', 'please_select_column')}
              className={`${groupPrefixCls}-list-item-groupName`}
              record={record}
              name="groupName"
              optionsFilter={optionsFilter}
              // notFoundContent={$l('Table', 'no_save_filter')}
              clearButton={false}
            />
            <Select
              record={record}
              name="groupType"
              className={`${groupPrefixCls}-list-item-groupType`}
              disabled
            >
              <Option value={GroupType.column}>列</Option>
              <Option value={GroupType.row}>行</Option>
              <Option value={GroupType.header}>表头</Option>
            </Select>
            <Button
              className={`${groupPrefixCls}-list-item-delete`}
              icon='delete_black-o'
              funcType={FuncType.link}
              color={ButtonColor.primary}
              onClick={() => groupDS.delete(record, false)}
            />
          </span>
        )}
      </Draggable>
    );
  };

  const popupContent = useMemo(() => {
    return (
      <div className={`${groupPrefixCls}-content`}>
        <div className={`${groupPrefixCls}-body`}>
          <div className={`${groupPrefixCls}-list-container`}>
            <DragDropContext onDragEnd={onDragEnd}>
              <Droppable
                droppableId="group-config"
                direction="vertical"
              >
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`${groupPrefixCls}-list`}
                  >
                    {groupDS.map((record, index) => {
                      const { key } = record;
                      return <GroupDragItem key={key} record={record} index={index} />;
                    })}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          </div>
          <div className={`${groupPrefixCls}-add-button`}>
            <Button
              funcType={FuncType.link}
              icon="add"
              onClick={() => groupDS.create()}
              color={ButtonColor.primary}
              disabled={groupDS.length >= groupFieldOptions.length}
            >
              添加配置
            </Button>
          </div>
        </div>
        <div className={`${groupPrefixCls}-footer`}>
          <Button onClick={handleCancel} icon='close'>{$l('Modal', 'cancel')}</Button>
          <Button onClick={handleConfirm} color={ButtonColor.primary} icon='done'>{$l('Modal', 'ok')}</Button>
        </div>
      </div>
    );
  }, [onDragEnd, groupFieldOptions.data, groupDS.data, dataSet, setVisible]);

  const popupTitle = useMemo(() => {
    return (
      <div className={`${groupPrefixCls}-header-inner`}>
        <span className={`${groupPrefixCls}-header-inner-title`}>分组配置</span>
      </div>
    );
  }, []);

  return (
    <Popover
      trigger="click"
      overlayClassName={`${groupPrefixCls}-popover`}
      title={popupTitle}
      content={popupContent}
      visible={visible}
      onVisibleChange={onVisibleChange}
      placement="bottomLeft"
    >
      <Button
        funcType={FuncType.flat}
        color={ButtonColor.primary}
        className={`${groupPrefixCls}-trigger-button`}
      >
        分组配置
      </Button>
    </Popover>
  );
}

GroupFieldConfig.displayName = 'GroupFieldConfig';

export default observer(GroupFieldConfig);
