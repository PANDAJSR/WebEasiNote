import { useMemo, useState } from 'react'
import { Modal, Pagination, Segmented } from 'antd'
import type { SlideData, SlideIssue } from '../types'
import { styles } from '../styles'

type IssueFilter = 'all' | SlideIssue['kind']
const pageSize = 100

interface ViewerIssuesModalProps {
  open: boolean
  onClose: () => void
  issues: SlideIssue[]
  slides: SlideData[]
}

/** 关闭时不遍历问题、不创建列表节点；打开后仅挂载当前批次。 */
export function ViewerIssuesModal({ open, onClose, issues, slides }: ViewerIssuesModalProps) {
  const [filter, setFilter] = useState<IssueFilter>('all')
  const [page, setPage] = useState(1)
  const data = useMemo(() => {
    if (!open) return null
    const slideOrder = new Map(slides.map((slide, index) => [slide.id, index + 1]))
    const counts = { 'unknown-element': 0, 'unknown-parameter': 0, 'missing-font': 0 }
    issues.forEach(issue => { counts[issue.kind]++ })
    const filtered = filter === 'all' ? [...issues] : issues.filter(issue => issue.kind === filter)
    const priority = { 'unknown-element': 0, 'unknown-parameter': 1, 'missing-font': 2 }
    filtered.sort((a, b) => {
      const pageA = slideOrder.get(a.slideId) || Number.MAX_SAFE_INTEGER
      const pageB = slideOrder.get(b.slideId) || Number.MAX_SAFE_INTEGER
      return pageA - pageB || priority[a.kind] - priority[b.kind]
        || a.elementType.localeCompare(b.elementType)
        || a.name.localeCompare(b.name) || a.elementId.localeCompare(b.elementId)
    })
    return { slideOrder, counts, filtered }
  }, [open, issues, slides, filter])
  if (!data) return null
  const currentPage = Math.min(page, Math.max(1, Math.ceil(data.filtered.length / pageSize)))
  const visible = data.filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  return (
    <Modal title='解析问题列表' open onCancel={onClose} footer={null} width={920} centered>
      <div style={styles.modalSummary}>
        <span>总计 {issues.length} 项</span>
        <span>未识别元素 {data.counts['unknown-element']} 项</span>
        <span>未识别参数 {data.counts['unknown-parameter']} 项</span>
        <span>缺失字体 {data.counts['missing-font']} 项</span>
      </div>
      <div style={styles.issueFilterBar}>
        <Segmented value={filter} onChange={value => { setFilter(value as IssueFilter); setPage(1) }}
          options={[
            { label: `全部 (${issues.length})`, value: 'all' },
            { label: `未识别元素 (${data.counts['unknown-element']})`, value: 'unknown-element' },
            { label: `未识别参数 (${data.counts['unknown-parameter']})`, value: 'unknown-parameter' },
            { label: `缺失字体 (${data.counts['missing-font']})`, value: 'missing-font' }
          ]} />
      </div>
      {visible.length === 0 && <div style={styles.modalEmpty}>当前筛选条件下没有问题</div>}
      <div style={styles.issueList}>
        {visible.map((issue, index) => (
          <div key={`${currentPage}-${index}`} style={styles.issueItem} data-viewer-issue='true'>
            <div style={styles.issueItemHeader}>
              <span style={styles.issueBadge}>
                {issue.kind === 'unknown-element' ? '未识别元素' : issue.kind === 'unknown-parameter' ? '未识别参数' : '缺失字体'}
              </span>
              <span style={styles.issueMeta}>
                第 {data.slideOrder.get(issue.slideId) || '?'} 页 | 元素类型: {issue.elementType} | 元素ID: {issue.elementId}
              </span>
            </div>
            <div style={styles.issueName}>名称: {issue.name}</div>
            {issue.value && <div style={styles.issueValue}>值: {issue.value}</div>}
          </div>
        ))}
      </div>
      <Pagination current={currentPage} pageSize={pageSize} total={data.filtered.length}
        showSizeChanger={false} onChange={setPage} />
    </Modal>
  )
}
