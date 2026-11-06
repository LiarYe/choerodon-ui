import React, { FunctionComponent, useCallback, ReactElement, MouseEventHandler, ReactNode, isValidElement, cloneElement, useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite'
import isArrayLike from 'choerodon-ui/dataset/mobx-helper/isArrayLike';
import warning from 'choerodon-ui/lib/_util/warning';
import isPromise from 'is-promise';
import classNames from 'classnames';
import isString from 'lodash/isString';
import isObject from 'lodash/isObject';
import Button from '../button';
import { FuncType } from '../button/enum';
import Dropdown from '../dropdown';
import Menu from '../menu';
import { $l } from '../locale-context';
import useComputed from '../use-computed';
import DataSet from '../data-set';
import Record from '../data-set/Record';
import { ButtonProps } from '../button/interface';
import { TableButtonProps, Commands } from '../table/Table';
import { TableCommandType } from '../table/interface';
import { ViewMode } from './enum';

export type cardCommandsProps = { dataSet: DataSet; record: Record; };

type CardCommandProps = {
  record: Record;
  prefixCls: string;
  buttonDisplay?: string;
  dataSet: DataSet;
  command?: Commands[] | ((props: cardCommandsProps) => Commands[]);
  renderCommand?: Function | ((props: any) => PromiseLike<any>);
  viewMode?: string;
  commandsLimit?: number;
};

const defaultRenderCommand = ({ command }) => command;

const CardCommand: FunctionComponent<CardCommandProps> = function CardCommand(props) {
  const {
    buttonDisplay,
    record,
    prefixCls,
    command,
    renderCommand = defaultRenderCommand,
    dataSet,
    viewMode,
    commandsLimit = 1,
  } = props;
  const [resolvedCommand, setResolvedCommand] = useState<{ promise: PromiseLike<any>; result: any } | null>(null);

  const cardCommand = useComputed(() => {
    if (typeof command === 'function') {
      const colC = command({ dataSet, record });
      return renderCommand({ command: colC, viewMode, dataSet, record })
    }
    return renderCommand({ command, viewMode, dataSet, record })
  }, [record, command, dataSet, renderCommand, viewMode]);

  const handleCommandDelete = useCallback((e) => {
    e.stopPropagation();
    dataSet.delete(record);
  }, [dataSet, record]);

  useEffect(() => {
    let current = true;
    if (isPromise(cardCommand)) {
      const resolveCommand = async () => {
        try {
          const result = await cardCommand;
          if (current) {
            setResolvedCommand({ promise: cardCommand, result });
          }
        } catch (error) {
          if (current) {
            setResolvedCommand({ promise: cardCommand, result: null });
            warning(false, error instanceof Error ? error.message : String(error));
          }
        }
      };
      resolveCommand();
    }
    return () => { current = false; };
  }, [cardCommand]);

  const result = isPromise(cardCommand)
    ? resolvedCommand && resolvedCommand.promise === cardCommand ? resolvedCommand.result : null
    : cardCommand;
  const item = useComputed(() => {
    const classString = classNames(`${prefixCls}-command`);
    if (result) {
      const commands: ReactElement<ButtonProps>[] = [];
      (result || []).forEach(button => {
        let tableButtonProps: TableButtonProps = {};
        if (isArrayLike(button)) {
          tableButtonProps = button[1] || {};
          button = button[0];
        }
        if (isString(button) && button in TableCommandType) {
          const getButtonProps = (
            type: TableCommandType,
          ): ButtonProps & { onClick: MouseEventHandler<any>; children?: ReactNode } | undefined => {
            switch (type) {
              case TableCommandType.delete:
                return {
                  funcType: FuncType.link,
                  onClick: handleCommandDelete,
                  // disabled,
                  children: $l('Table', 'delete_button'),
                };
              default:
            }
          };
          const defaultButtonProps = getButtonProps(button as TableCommandType);
          if (defaultButtonProps) {
            const { afterClick, ...buttonProps } = tableButtonProps;
            if (afterClick) {
              const { onClick } = defaultButtonProps;
              defaultButtonProps.onClick = async e => {
                e.persist();
                e.stopPropagation();
                try {
                  await onClick(e);
                } finally {
                  afterClick(e);
                }
              };
            }
            const { ...otherProps } = defaultButtonProps;
            commands.push(
              <Button
                {...otherProps}
                {...buttonProps}
                className={classNames(classString, otherProps.className, buttonProps.className)}
              />,
            );
          }
        } else if (isValidElement<ButtonProps>(button)) {
          commands.push(cloneElement(button, {
            ...button.props,
            onClick: (e) => {
              e.stopPropagation();
              button.props.onClick!(e);
            },
            funcType: FuncType.link,
            className: classNames(classString, button.props.className),
          }));
        } else if (isObject(button)) {
          commands.push(
            <Button
              {...button}
              funcType={FuncType.link}
              className={classNames(classString, (button as ButtonProps).className)}
            />,
          );
        }
      });
      return commands;
    }
  }, [prefixCls, result, handleCommandDelete]);

  const renderMoreBtns = useCallback(() => {
    if (!item) {
      return null;
    }
    const thiscCommandsLimit = buttonDisplay === 'limit' ?  commandsLimit : 0;
    if (thiscCommandsLimit >= item.length) {
      return null;
    }
    return (<Dropdown
      popupClassName={`${prefixCls}-quote-container-extra-popup`}
      overlay={() => (
        <Menu>
          {item.slice(thiscCommandsLimit).map(cmd => (
            <Menu.Item key={cmd.key || `${record.id}_cmd`}>
              {cmd}
            </Menu.Item>
          ))}
        </Menu>
      )}>
      <Button
        icon="more_horiz"
        funcType={FuncType.flat}
        onClick={(e) => e.stopPropagation()}
      />
    </Dropdown>);
  }, [item, commandsLimit, buttonDisplay, prefixCls, record]);

  return (
    item ? (
      buttonDisplay === 'limit' ?
        viewMode === ViewMode.kanban ? <div className={`${prefixCls}-quote-container-extra`}>
          {item.slice(0, commandsLimit)}
          {renderMoreBtns()}
        </div> : (<>
          {item.slice(0, commandsLimit)}
          {renderMoreBtns()}
        </>) :
        renderMoreBtns()
    ) : null
  );
}

CardCommand.displayName = 'CardCommand';

export default observer(CardCommand);
