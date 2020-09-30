import React from 'react';
import ReactDOM from 'react-dom';
import { PerformanceTable } from 'choerodon-ui/pro';
import _ from 'lodash';

export const EditCell = ({ rowData, dataIndex, onChange }) => {
  return (
      rowData.status === 'EDIT' ? (
        <input
          className="input"
          defaultValue={rowData[dataIndex]}
          onChange={event => {
            onChange && onChange(rowData.id, dataIndex, event.target.value);
          }}
        />
      ) : (
        rowData[dataIndex]
      )
  );
};

const ActionCell = ({ rowData, onClick }) => {
  return (
      <a
        onClick={() => {
          onClick && onClick(rowData.id);
        }}
      >
        {rowData.status === 'EDIT' ? 'Save' : 'Edit'}
      </a>
  );
};

class EditTable extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      data: fakeData.filter((item, index) => index < 20)
    };
    this.handleChange = this.handleChange.bind(this);
    this.handleEditState = this.handleEditState.bind(this);
  }
  handleChange(id, key, value) {
    const { data } = this.state;
    const nextData = _.clone(data);
    nextData.find(item => item.id === id)[key] = value;
    this.setState({
      data: nextData
    });
  }
  handleEditState(id) {
    const { data } = this.state;
    const nextData = _.clone(data);
    const activeItem = nextData.find(item => item.id === id);
    activeItem.status = activeItem.status ? null : 'EDIT';

    this.setState({
      data: nextData
    });
  }
  render() {
    const { data } = this.state;
    const columns = [
        {
          title: '姓',
          dataIndex: 'lastName',
          key: 'lastName',
          width: 200, 
          fixed: true,
          render: ({ rowData, dataIndex }) => EditCell({ rowData, dataIndex, onChange: this.handleChange }),
        },  
        {
          title: '名',
          dataIndex: 'firstName',
          key: 'firstName',
          width: 300, 
          render: ({ rowData, dataIndex }) => EditCell({ rowData, dataIndex, onChange: this.handleChange }),
        },           
        {
          title: '邮箱',
          dataIndex: 'email',
          key: 'email',
          width: 200,
          render: ({ rowData, dataIndex }) => EditCell({ rowData, dataIndex, onChange: this.handleChange }),
        },
        {
          title: 'Action',
          dataIndex: 'id',
          key: 'id',
          flexGrow: 1, 
          align: "center", 
          render: ({ rowData }) => ActionCell({ rowData, onClick: this.handleEditState }),
        },   
      ];
    
    return (
        <PerformanceTable
          height={400}
          data={data}
          columns={columns}
        />
    );
  }
}

ReactDOM.render(<EditTable />, document.getElementById('container'));